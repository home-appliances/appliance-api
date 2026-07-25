/**
 * 导入 ZOL 空调爬虫数据到本地数据库
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import {seatParams,type ParamDefMeta} from '../src/utils/normalize-param-value.js';
import {ensureImportExceptionsTable,insertExceptions,writeExceptionsJson,printExceptionSummary,supersedeOpenExceptions,type ExceptionRow} from './lib/import-exceptions.js';
import { ensureRemoteImageOnOss, isOssCdnUrl } from '../src/utils/image-oss-pipeline.js';
import {downloadToLocal,isLocalImageUrl,useLocalImageStorage} from '../src/utils/image-local.js';

dotenv.config();

// 配置
const DEFAULT_DATA_DIR = path.join(
  process.env.HOME || '/Users/liuhui',
  'Desktop',
  'crawler_test',
  'data'
);

const CATEGORY_CODE = 'air_condition';
const SOURCE_PLATFORM = 'zol';

/**
 * ZOL 字段 → 系统 param_key 映射。
 * 未列出的字段若与系统 param_key 同名则直接保留；
 * 映射后仍不在 category_params 白名单内的一律丢弃，不自动扩参。
 */
const PARAM_MAP: Record<string, string> = {
  // 示例（当前 ZOL 与系统同名，暂无别名）:
  // '净化功能': '空气净化',
};

// 品牌字典（用于从产品名中提取品牌）
const BRAND_DICTIONARY = [
  // 4字品牌
  '三菱电机', '三菱重工', '富士通将军',
  // 3字品牌
  '卡萨帝', '富士通', '欧瑞博', '格兰仕', '澳柯玛', '荣事达', '小天鹅',
  // 2字品牌
  '格力', '美的', '海尔', '海信', '奥克斯', '志高', '三菱', '大金', '松下',
  '长虹', '康佳', '创维', '华凌', '科龙', '扬子', '新科', '日立', '三星',
  '夏普', '东芝', '云米', '夏新', '酷开', '现代', '深松', '申花', '帝智',
  '乐京', '东宝', '新飞', '先科', '米家', '小米', '飞利浦', '惠而浦',
  '伊莱克斯', '统帅',
  // 英文品牌
  'COLMO', 'Midea', 'Leader', 'JHS', 'TCL', 'LG', 'MITSEIN',
];

// 英文品牌 → 中文映射
const ENG_TO_CHN: Record<string, string> = {
  Midea: '美的',
  Leader: '统帅',
};

// 品牌归一化映射（系列名 / 营销名 → 真品牌）
const BRAND_NORMALIZE: Record<string, string> = {
  '大金空调': '大金',
  '富士通将军': '富士通',
  '卡萨帝揽光空调': '卡萨帝',
  '卡萨帝星悦空调': '卡萨帝',
  '卡萨帝鉴赏家': '卡萨帝',
  '米家巨省电': '米家',
  '米家互联网空调': '米家',
  '米家互联网立式空调': '米家',
  '米家强劲风': '米家',
  '米家新风': '米家',
  '米家空调': '米家',
  '米家速冷静': '米家',
  '小米柔风立式空调': '小米',
  '小米柔风空调': '小米',
  '小米智米变频空调': '小米',
  '小米米家直流变频两季扇': '小米',
  '美的酷省电': '美的',
  '美的酷省电二代': '美的',
  '美的风酷': '美的',
  '美的生活': '美的',
  '志高清风系列': '志高',
  '志高星动': '志高',
  '格力云锦天猫精灵语言互联空调': '格力',
  '格力舒适风': '格力',
  '欧瑞博集成空调': '欧瑞博',
};

const DIRTY_BRAND_RE =
  /系列|互联网|变频|天猫|精灵|酷省电|柔风|清风|星动|两季扇|立式空调|速冷静|强劲风|新风|鉴赏家|星悦|风酷|舒适风|语言互联/;

function sortedBrandDict(): string[] {
  return [...BRAND_DICTIONARY].sort((a, b) => b.length - a.length);
}

/** 从产品名中提取真实品牌 */
function extractBrandFromName(name: string): string | null {
  if (!name) return null;

  const parenMatch = name.match(/[（(]\s*([^（）()]{2,8})\s*[）)]/);
  if (parenMatch) {
    const inner = parenMatch[1].trim();
    if (/^[\u4e00-\u9fa5A-Za-z]+$/.test(inner) && BRAND_DICTIONARY.includes(inner)) {
      return normalizeBrand(inner);
    }
  }

  for (const brand of sortedBrandDict()) {
    if (name.startsWith(brand)) {
      return normalizeBrand(brand);
    }
  }

  const engMatch = name.match(/^([A-Za-z]{2,})[\s\/]/);
  if (engMatch) {
    const eng = engMatch[1];
    if (BRAND_DICTIONARY.includes(eng)) {
      return normalizeBrand(eng);
    }
  }

  return null;
}

/** 品牌归一化：显式映射 → 字典前缀剥离系列名 → 原样 */
function normalizeBrand(brand: string): string {
  const trimmed = (brand || '').trim();
  if (!trimmed) return trimmed;
  if (BRAND_NORMALIZE[trimmed]) return BRAND_NORMALIZE[trimmed];
  if (ENG_TO_CHN[trimmed]) return ENG_TO_CHN[trimmed];
  if (BRAND_DICTIONARY.includes(trimmed)) return trimmed;

  for (const b of sortedBrandDict()) {
    if (trimmed.startsWith(b) && trimmed.length > b.length) {
      return BRAND_NORMALIZE[b] || ENG_TO_CHN[b] || b;
    }
  }
  return trimmed;
}

function isDirtyBrand(brand: string): boolean {
  const b = (brand || '').trim();
  if (!b || b === '未知品牌') return true;
  if (BRAND_DICTIONARY.includes(b) || ENG_TO_CHN[b]) return false;
  return DIRTY_BRAND_RE.test(b) || b.length > 6;
}

/** 解析品牌：JSON brand 优先，系列名/脏名则再从产品名提取 */
function resolveBrand(jsonBrand: string | undefined, name: string): string {
  const raw = (jsonBrand || '').trim();
  if (raw && raw !== '未知品牌') {
    const normalized = normalizeBrand(raw);
    if (!isDirtyBrand(normalized)) return normalized;
    const fromName = extractBrandFromName(name);
    if (fromName && !isDirtyBrand(fromName)) return fromName;
    return normalized;
  }
  const extracted = extractBrandFromName(name);
  return extracted || '未知品牌';
}

// 参数解析
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const NORMALIZE_EXISTING = args.includes('--normalize-existing');
const SKIP_OSS_IMAGES = args.includes('--skip-oss-images');
const dirArgIdx = args.indexOf('--dir');
const DATA_DIR = dirArgIdx >= 0 ? args[dirArgIdx + 1] : DEFAULT_DATA_DIR;

// 数据库连接
const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'appliance_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres123',
});

// ZOL JSON 数据结构
interface ZolProduct {
  id: string;
  catalog_url: string;
  name: string;
  brand: string;
  price: string;
  main_image?: string;
  images?: string[];
  parameters: Record<string, string>;
  crawl_status: string;
  crawled_at: string;
}

// 工具函数
/** 递归读取目录下所有 JSON 文件 */
function getAllJsonFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllJsonFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(fullPath);
    }
  }
  return files;
}

/** 从产品名或参数中提取型号 */
function extractModel(data: ZolProduct): string | null {
  if (data.parameters['产品型号']) return data.parameters['产品型号'];
  const nameMatch = data.name.match(/([A-Z]{2,}[\w\-/()]+)/);
  if (nameMatch) return nameMatch[1];
  return null;
}

/** 解析价格：处理区间（取最低价）和非数字情况 */
function parsePrice(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (['无', '即将上市', '停产', '报价取消', '暂无报价'].includes(trimmed)) return null;
  const match = trimmed.match(/(\d+(?:\.\d+)?)/);
  return match ? match[1] : null;
}

/** 清理参数对象：去掉空值 */
function cleanParams(params: Record<string, string>): Record<string, string> {
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value && value.trim() && value.trim() !== '——') {
      cleaned[key] = value.trim();
    }
  }
  return cleaned;
}

/**
 * Transform：白名单 + 入座 → params，例外记 import_exceptions
 * 原材料以爬虫 JSON 为准
 */
function mapFilterAndSeatParams(
  raw: Record<string, string>,
  allowedKeys: Set<string>,
  paramDefs: Map<string, ParamDefMeta>,
  discarded: Map<string, number>,
  valueChangeCounts: Map<string, number>
): {
  params: Record<string, string>;
  exceptions: ExceptionRow[];
} {
  const cleaned = cleanParams(raw);
  const mapped: Record<string, string> = {};
  const exceptions: ExceptionRow[] = [];

  for (const [sourceKey, value] of Object.entries(cleaned)) {
    const systemKey = PARAM_MAP[sourceKey] ?? sourceKey;
    if (!allowedKeys.has(systemKey)) {
      discarded.set(sourceKey, (discarded.get(sourceKey) || 0) + 1);
      exceptions.push({
        type: 'unknown_key',
        paramKey: sourceKey,
        rawValue: value,
        reason: `不在 category_params 白名单（映射后 key=${systemKey}），已丢弃`,
      });
      continue;
    }
    mapped[systemKey] = value;
  }

  const { params, changes, exceptions: valueEx } = seatParams(mapped, paramDefs);
  for (const c of changes) {
    const label = `${c.key}: ${c.from} → ${c.to}`;
    valueChangeCounts.set(label, (valueChangeCounts.get(label) || 0) + 1);
  }
  exceptions.push(...valueEx);
  return { params, exceptions };
}

async function loadParamDefs(categoryId: number | string): Promise<{
  allowedKeys: Set<string>;
  paramDefs: Map<string, ParamDefMeta>;
}> {
  const paramDefResult = await pool.query(
    `SELECT param_key, param_type, enum_values
     FROM category_params WHERE category_id = $1`,
    [categoryId]
  );
  const allowedKeys = new Set<string>();
  const paramDefs = new Map<string, ParamDefMeta>();
  for (const row of paramDefResult.rows as Array<{
    param_key: string;
    param_type: string;
    enum_values: string[] | null;
  }>) {
    allowedKeys.add(row.param_key);
    paramDefs.set(row.param_key, {
      paramType: row.param_type || 'text',
      enumValues: row.enum_values,
    });
  }
  return { allowedKeys, paramDefs };
}

/** 回刷：从桌面爬虫 JSON（按 source_url）重新 Transform，写回 params + 例外 */
async function normalizeExistingProducts(
  categoryId: number | string,
  paramDefs: Map<string, ParamDefMeta>,
  allowedKeys: Set<string>
) {
  const batchId = `zol-normalize-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  console.log('🔄 回刷模式: 从爬虫 JSON 重新 Transform（不重导图片）');
  console.log(`📁 JSON 目录: ${DATA_DIR}`);
  console.log(`📦 batch_id: ${batchId}\n`);

  const jsonByUrl = new Map<string, Record<string, string>>();
  if (!fs.existsSync(DATA_DIR)) {
    console.error(`❌ 数据目录不存在: ${DATA_DIR}`);
    process.exit(1);
  }
  const jsonFiles = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.join(DATA_DIR, f));
  for (const file of jsonFiles) {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf-8')) as ZolProduct;
      if (data.catalog_url) {
        jsonByUrl.set(data.catalog_url, data.parameters || {});
      }
    } catch {
      /* skip */
    }
  }
  console.log(`📂 已索引 JSON: ${jsonByUrl.size} 个\n`);

  await ensureImportExceptionsTable(pool);
  if (!DRY_RUN) {
    const n = await supersedeOpenExceptions(pool, SOURCE_PLATFORM);
    if (n) console.log(`↪️  旧 open 例外已标 superseded: ${n}`);
  }

  const res = await pool.query(
    `SELECT id, name, source_url, params FROM products
     WHERE category_id = $1 AND source_platform = $2 AND deleted_at IS NULL`,
    [categoryId, SOURCE_PLATFORM]
  );

  let updated = 0;
  let unchanged = 0;
  let noJson = 0;
  const sampleChanges: string[] = [];
  const valueChangeCounts = new Map<string, number>();
  const allExceptions: ExceptionRow[] = [];

  for (const row of res.rows as Array<{
    id: number;
    name: string;
    source_url: string;
    params: Record<string, string>;
  }>) {
    const extract = jsonByUrl.get(row.source_url);
    if (!extract) {
      noJson++;
      continue;
    }
    const prevParams = (row.params || {}) as Record<string, string>;
    const discarded = new Map<string, number>();
    const { params, exceptions } = mapFilterAndSeatParams(
      extract,
      allowedKeys,
      paramDefs,
      discarded,
      valueChangeCounts
    );

    for (const ex of exceptions) {
      allExceptions.push({
        ...ex,
        productId: row.id,
        sourceUrl: row.source_url,
        productName: row.name,
      });
    }

    const paramsSame = JSON.stringify(sortObj(params)) === JSON.stringify(sortObj(prevParams));
    if (paramsSame) {
      unchanged++;
      continue;
    }

    for (const [k, v] of Object.entries(params)) {
      if (prevParams[k] !== v && sampleChanges.length < 15) {
        sampleChanges.push(`#${row.id} ${k}: ${prevParams[k] ?? '(空)'} → ${v}`);
      }
    }

    if (!DRY_RUN) {
      await pool.query(`UPDATE products SET params = $1, updated_at = NOW() WHERE id = $2`, [
        JSON.stringify(params),
        row.id,
      ]);
    }
    updated++;
  }

  console.log(`📊 产品总数: ${res.rows.length}`);
  console.log(`✅ 需要更新: ${updated}${DRY_RUN ? '（预览未写入）' : ''}`);
  console.log(`⏭️  无需变更: ${unchanged}`);
  console.log(`📭 无对应 JSON: ${noJson}`);
  if (sampleChanges.length) {
    console.log('\n📝 变更样例:');
    sampleChanges.forEach((s) => console.log(`   ${s}`));
  }
  if (valueChangeCounts.size) {
    console.log('\n📈 高频入座变换 (Top 20):');
    [...valueChangeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .forEach(([label, n]) => console.log(`   ${n}× ${label}`));
  }

  printExceptionSummary(allExceptions);
  const jsonPath = writeExceptionsJson(batchId, allExceptions);
  console.log(`📄 例外清单: ${jsonPath}`);

  if (!DRY_RUN && allExceptions.length > 0) {
    const n = await insertExceptions(pool, {
      batchId,
      sourcePlatform: SOURCE_PLATFORM,
      categoryId,
      rows: allExceptions,
    });
    console.log(`💾 例外已写入 import_exceptions: ${n} 条`);
  } else if (DRY_RUN) {
    console.log('🔍 [预览] 例外未写入数据库');
  }
}

function sortObj(obj: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
}

// 主流程
async function main() {
  console.log('🚀 ZOL 空调数据导入工具');
  console.log('='.repeat(60));
  console.log(`🏷️  分类: ${CATEGORY_CODE}`);
  console.log(`📦 来源: ${SOURCE_PLATFORM}`);
  if (NORMALIZE_EXISTING) {
    console.log('🔄 模式: 回刷已入库 params（值归一化）');
  } else {
    console.log(`📁 数据目录: ${DATA_DIR}`);
  }
  console.log(`${DRY_RUN ? '🔍 [预览模式] 只解析不写入' : '💾 [写入模式] 数据将写入数据库'}`);
  console.log('');

  const catResult = await pool.query(
    'SELECT id FROM categories WHERE code = $1',
    [CATEGORY_CODE]
  );
  if (catResult.rows.length === 0) {
    console.error(`❌ 数据库中找不到分类: ${CATEGORY_CODE}`);
    process.exit(1);
  }
  const categoryId = catResult.rows[0].id;
  console.log(`📂 分类 ID: ${categoryId} (${CATEGORY_CODE})\n`);

  const { allowedKeys, paramDefs } = await loadParamDefs(categoryId);
  if (allowedKeys.size === 0) {
    console.error('❌ 该分类尚未配置 category_params，拒绝导入（避免无规范入库）');
    process.exit(1);
  }
  console.log(`🧭 系统参数白名单: ${allowedKeys.size} 个`);
  if (Object.keys(PARAM_MAP).length > 0) {
    console.log(`🔗 显式映射: ${Object.keys(PARAM_MAP).length} 条`);
  }
  console.log('');

  if (NORMALIZE_EXISTING) {
    await normalizeExistingProducts(categoryId, paramDefs, allowedKeys);
    await pool.end();
    console.log('\n✨ 回刷完成！');
    return;
  }

  if (!fs.existsSync(DATA_DIR)) {
    console.error(`❌ 数据目录不存在: ${DATA_DIR}`);
    process.exit(1);
  }

  const jsonFiles = getAllJsonFiles(DATA_DIR);
  console.log(`📊 找到 ${jsonFiles.length} 个 JSON 文件`);

  if (jsonFiles.length === 0) {
    console.log('❌ 没有找到数据文件');
    process.exit(0);
  }

  const batchId = `zol-import-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  console.log(`📦 batch_id: ${batchId}`);
  console.log('📦 解析产品数据...');
  const products: Array<{
    name: string;
    brand: string;
    model: string | null;
    price: string | null;
    params: Record<string, string>;
    exceptions: ExceptionRow[];
    sourceUrl: string;
    mainImage: string | null;
    images: string[];
    filePath: string;
  }> = [];
  const parseErrors: string[] = [];
  const discardedKeys = new Map<string, number>();
  const valueChangeCounts = new Map<string, number>();
  const allExceptions: ExceptionRow[] = [];

  for (const file of jsonFiles) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const data: ZolProduct = JSON.parse(content);

      if (!data.name) {
        parseErrors.push(`${file}: 无产品名`);
        continue;
      }

      const allImages = [
        ...(data.main_image ? [data.main_image] : []),
        ...(data.images || []),
      ].filter(Boolean);

      const { params, exceptions } = mapFilterAndSeatParams(
        data.parameters || {},
        allowedKeys,
        paramDefs,
        discardedKeys,
        valueChangeCounts
      );

      const exWithMeta = exceptions.map((ex) => ({
        ...ex,
        sourceUrl: data.catalog_url,
        productName: data.name,
      }));
      allExceptions.push(...exWithMeta);

      products.push({
        name: data.name,
        brand: resolveBrand(data.brand, data.name),
        model: extractModel(data),
        price: parsePrice(data.price),
        params,
        exceptions: exWithMeta,
        sourceUrl: data.catalog_url,
        mainImage: data.main_image || null,
        images: allImages,
        filePath: file,
      });
    } catch (err) {
      parseErrors.push(`${file}: ${(err as Error).message}`);
    }
  }

  console.log(`✅ 解析完成: ${products.length} 成功, ${parseErrors.length} 失败`);
  if (parseErrors.length > 0 && parseErrors.length < 20) {
    parseErrors.forEach(e => console.log(`   ⚠️  ${e}`));
  }

  const keptKeyCounts = new Map<string, number>();
  for (const p of products) {
    for (const key of Object.keys(p.params)) {
      keptKeyCounts.set(key, (keptKeyCounts.get(key) || 0) + 1);
    }
  }
  console.log(`\n📌 将入库的系统参数: ${keptKeyCounts.size} 种`);
  if (discardedKeys.size > 0) {
    console.log(`🗑️  未知键丢弃: ${discardedKeys.size} 种（已记例外）`);
    [...discardedKeys.entries()]
      .sort((a, b) => b[1] - a[1])
      .forEach(([key, count]) => console.log(`   - ${key}: ${count} 次`));
  } else {
    console.log('🗑️  未知键丢弃: 无');
  }
  if (valueChangeCounts.size > 0) {
    console.log(`🔧 入座变换 (Top 20):`);
    [...valueChangeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .forEach(([label, count]) => console.log(`   ${count}× ${label}`));
  } else {
    console.log('🔧 入座变换: 无');
  }
  printExceptionSummary(allExceptions);
  const jsonPath = writeExceptionsJson(batchId, allExceptions);
  console.log(`📄 例外清单: ${jsonPath}`);
  console.log('');

  const brandDist: Record<string, number> = {};
  for (const p of products) {
    brandDist[p.brand] = (brandDist[p.brand] || 0) + 1;
  }
  console.log('📋 品牌分布:');
  Object.entries(brandDist)
    .sort((a, b) => b[1] - a[1])
    .forEach(([brand, count]) => console.log(`   ${brand}: ${count} 个`));
  console.log('');

  if (DRY_RUN) {
    console.log('🔍 [预览模式] 未写入数据库');
    await pool.end();
    return;
  }

  await ensureImportExceptionsTable(pool);
  {
    const n = await supersedeOpenExceptions(pool, SOURCE_PLATFORM);
    if (n) console.log(`↪️  旧 open 例外已标 superseded: ${n}`);
  }

  console.log('💾 写入产品数据...');
  let inserted = 0;
  let skipped = 0;
  let failed = 0;
  const productIdMap = new Map<string, number>();

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    try {
      const result = await pool.query(
        `INSERT INTO products (name, brand, model, category_id, price, params, source_url, source_platform, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
         ON CONFLICT (source_url) DO UPDATE SET
           name = EXCLUDED.name,
           brand = EXCLUDED.brand,
           model = EXCLUDED.model,
           category_id = EXCLUDED.category_id,
           price = EXCLUDED.price,
           params = EXCLUDED.params,
           source_platform = EXCLUDED.source_platform,
           updated_at = NOW()
         RETURNING id, (xmax = 0) AS is_insert`,
        [
          p.name,
          p.brand,
          p.model,
          categoryId,
          p.price,
          JSON.stringify(p.params),
          p.sourceUrl,
          SOURCE_PLATFORM,
        ]
      );

      const row = result.rows[0];
      productIdMap.set(p.sourceUrl, row.id);
      if (row.is_insert) {
        inserted++;
      } else {
        skipped++;
      }
    } catch (err) {
      failed++;
      if (failed <= 5) {
        console.error(`   ❌ ${p.name}: ${(err as Error).message}`);
      }
    }

    if ((i + 1) % 50 === 0 || i + 1 === products.length) {
      console.log(`   ⌛ 进度: ${i + 1}/${products.length} (插入 ${inserted}, 跳过 ${skipped}, 失败 ${failed})`);
    }
  }

  console.log(`✅ 产品写入完成: 新增 ${inserted}, 更新 ${skipped}, 失败 ${failed}\n`);

  // 例外补上 product_id 后落库
  if (allExceptions.length > 0) {
    for (const ex of allExceptions) {
      if (ex.sourceUrl && productIdMap.has(ex.sourceUrl)) {
        ex.productId = productIdMap.get(ex.sourceUrl)!;
      }
    }
    const n = await insertExceptions(pool, {
      batchId,
      sourcePlatform: SOURCE_PLATFORM,
      categoryId,
      rows: allExceptions,
    });
    console.log(`🏷️  例外已写入 import_exceptions: ${n} 条 (batch=${batchId}, status=open)\n`);
  }

  console.log(
    useLocalImageStorage()
      ? '🖼️  写入主图（源图→桌面 images-data，写入 products.main_image）...'
      : '🖼️  写入主图（源图→OSS，写入 products.main_image）...'
  );
  if (SKIP_OSS_IMAGES) {
    console.log('⚠️  --skip-oss-images：仅写入源站 URL（不推荐，仅调试）');
  }
  let imgOk = 0;
  let imgFail = 0;
  const localMode = useLocalImageStorage();

  for (const p of products) {
    const productId = productIdMap.get(p.sourceUrl);
    if (!productId || p.images.length === 0) continue;

    const srcUrl = p.images[0] || p.mainImage;
    if (!srcUrl) continue;

    try {
      let storeUrl = srcUrl;
      if (!SKIP_OSS_IMAGES && !isOssCdnUrl(srcUrl) && !isLocalImageUrl(srcUrl)) {
        if (localMode) {
          storeUrl = (await downloadToLocal(srcUrl, { filename: `p${productId}-main.jpg` })).url;
        } else {
          storeUrl = await ensureRemoteImageOnOss(srcUrl);
        }
      }
      await pool.query(
        `UPDATE products SET main_image = $1, image_id = NULL, updated_at = NOW() WHERE id = $2`,
        [storeUrl, productId]
      );
      imgOk++;
    } catch (err) {
      imgFail++;
      if (imgFail <= 5) {
        console.warn(`   ⚠️ 主图失败 #${productId}: ${(err as Error).message}`);
      }
    }
  }

  console.log(`✅ 主图完成: ${imgOk} 写入, ${imgFail} 失败\n`);

  // search_vector 由 DB 触发器 products_search_vector_trigger 在 INSERT/UPDATE 时自动维护
  // （name + brand + model + params），无需在此手写覆盖
  console.log('🔍 搜索向量：由数据库触发器自动维护（含 params），跳过手写回写\n');

  const stats = await pool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(DISTINCT brand) as brands,
      COUNT(DISTINCT model) as models,
      COUNT(*) FILTER (WHERE main_image IS NOT NULL AND main_image <> '') as with_main
    FROM products
    WHERE category_id = $1 AND deleted_at IS NULL
  `, [categoryId]);

  console.log('='.repeat(60));
  console.log('📊 导入统计:');
  console.log(`   空调产品总数: ${stats.rows[0].total}`);
  console.log(`   品牌数量: ${stats.rows[0].brands}`);
  console.log(`   型号数量: ${stats.rows[0].models}`);
  console.log(`   有主图: ${stats.rows[0].with_main}`);
  console.log('='.repeat(60));

  const brandStats = await pool.query(`
    SELECT brand, COUNT(*) as count
    FROM products
    WHERE category_id = $1 AND deleted_at IS NULL
    GROUP BY brand
    ORDER BY count DESC
  `, [categoryId]);

  console.log('\n📋 数据库品牌统计:');
  for (const row of brandStats.rows) {
    console.log(`   ${row.brand}: ${row.count} 个`);
  }

  await pool.end();
  console.log('\n✨ 导入完成！');
}

main().catch((error) => {
  console.error('❌ 执行失败:', error);
  process.exit(1);
});
