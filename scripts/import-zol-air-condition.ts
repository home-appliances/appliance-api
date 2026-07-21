/**
 * 导入 ZOL 空调爬虫数据到本地数据库
 *
 * 数据源: ~/Desktop/crawler_test/data/ 目录下的 JSON 文件（按品牌分目录）
 * 目标表: products + product_images
 *
 * 运行: npx tsx scripts/import-zol-air-condition.ts
 *   可选参数: --dry-run  只解析不写入
 *             --dir <path>  自定义数据目录
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// ════════════════════════════════════════════════════════════
// 配置
// ════════════════════════════════════════════════════════════

const DEFAULT_DATA_DIR = path.join(
  process.env.HOME || '/Users/liuhui',
  'Desktop',
  'crawler_test',
  'data'
);

const CATEGORY_CODE = 'air_condition';
const SOURCE_PLATFORM = 'zol';

// ════════════════════════════════════════════════════════════
// 品牌字典（用于从产品名中提取品牌）
// ════════════════════════════════════════════════════════════

// 已知品牌（中文优先）。长的放前面，避免短名误匹配。
// 例如 "三菱电机" 必须在 "三菱" 之前匹配。
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
  '伊莱克斯',
  // 英文品牌（保留原名）
  'COLMO', 'Midea', 'Leader', 'JHS', 'TCL', 'LG',
];

// 英文品牌 → 中文映射（更友好的展示）
const ENG_TO_CHN: Record<string, string> = {
  Midea: '美的',
  Leader: '统帅',
};

// 品牌归一化映射（合并重复品牌）
const BRAND_NORMALIZE: Record<string, string> = {
  '大金空调': '大金',
  '富士通将军': '富士通',
  '卡萨帝揽光空调': '卡萨帝',
  '米家巨省电': '米家',
  '小米柔风立式空调': '小米',
  '欧瑞博集成空调': '欧瑞博',
};

/** 从产品名中提取真实品牌 */
function extractBrandFromName(name: string): string | null {
  if (!name) return null;

  // 1. 优先匹配中文括号内的品牌："Midea（美的）智弧..." → "美的"
  const parenMatch = name.match(/[（(]\s*([^（）()]{2,8})\s*[）)]/);
  if (parenMatch) {
    const inner = parenMatch[1].trim();
    if (/^[\u4e00-\u9fa5A-Za-z]+$/.test(inner) && BRAND_DICTIONARY.includes(inner)) {
      return normalizeBrand(inner);
    }
  }

  // 2. 从 name 开头匹配品牌字典（长名优先）
  const sortedBrands = [...BRAND_DICTIONARY].sort((a, b) => b.length - a.length);
  for (const brand of sortedBrands) {
    if (name.startsWith(brand)) {
      return normalizeBrand(brand);
    }
  }

  // 3. 英文品牌名开头："Leader KFR-72GW/..." → "统帅"
  const engMatch = name.match(/^([A-Za-z]{2,})[\s\/]/);
  if (engMatch) {
    const eng = engMatch[1];
    if (BRAND_DICTIONARY.includes(eng)) {
      return normalizeBrand(eng);
    }
  }

  return null;
}

/** 品牌归一化 */
function normalizeBrand(brand: string): string {
  return BRAND_NORMALIZE[brand] || ENG_TO_CHN[brand] || brand;
}

/** 解析品牌：JSON brand 字段优先，若为空或"未知品牌"则从 name 提取 */
function resolveBrand(jsonBrand: string | undefined, name: string): string {
  const raw = (jsonBrand || '').trim();
  if (raw && raw !== '未知品牌') {
    return normalizeBrand(raw);
  }
  const extracted = extractBrandFromName(name);
  return extracted || '未知品牌';
}

// ════════════════════════════════════════════════════════════
// 参数解析
// ════════════════════════════════════════════════════════════

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const dirArgIdx = args.indexOf('--dir');
const DATA_DIR = dirArgIdx >= 0 ? args[dirArgIdx + 1] : DEFAULT_DATA_DIR;

// ════════════════════════════════════════════════════════════
// 数据库连接
// ════════════════════════════════════════════════════════════

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'appliance_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres123',
});

// ════════════════════════════════════════════════════════════
// ZOL JSON 数据结构
// ════════════════════════════════════════════════════════════

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

// ════════════════════════════════════════════════════════════
// 工具函数
// ════════════════════════════════════════════════════════════

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
  // 优先用 parameters 中的产品型号
  if (data.parameters['产品型号']) return data.parameters['产品型号'];
  // 从名称中提取（常见格式：品牌+型号，如"格力KFR-26GW/..."）
  const nameMatch = data.name.match(/([A-Z]{2,}[\w\-/()]+)/);
  if (nameMatch) return nameMatch[1];
  return null;
}

/** 解析价格：处理区间（取最低价）和非数字情况 */
function parsePrice(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (['无', '即将上市', '停产', '报价取消', '暂无报价'].includes(trimmed)) return null;
  // 提取第一个数字（含小数）
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

// ════════════════════════════════════════════════════════════
// 主流程
// ════════════════════════════════════════════════════════════

async function main() {
  console.log('🚀 ZOL 空调数据导入工具');
  console.log('='.repeat(60));
  console.log(`📁 数据目录: ${DATA_DIR}`);
  console.log(`🏷️  分类: ${CATEGORY_CODE}`);
  console.log(`📦 来源: ${SOURCE_PLATFORM}`);
  console.log(`${DRY_RUN ? '🔍 [预览模式] 只解析不写入' : '💾 [写入模式] 数据将写入数据库'}`);
  console.log('');

  // 1. 读取所有 JSON 文件
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

  // 2. 获取分类 ID
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

  // 3. 解析所有产品数据
  console.log('📦 解析产品数据...');
  const products: Array<{
    name: string;
    brand: string;
    model: string | null;
    price: string | null;
    params: Record<string, string>;
    sourceUrl: string;
    mainImage: string | null;
    images: string[];
    filePath: string;
  }> = [];
  const parseErrors: string[] = [];

  for (const file of jsonFiles) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const data: ZolProduct = JSON.parse(content);

      // 跳过无效数据
      if (!data.name) {
        parseErrors.push(`${file}: 无产品名`);
        continue;
      }

      const allImages = [
        ...(data.main_image ? [data.main_image] : []),
        ...(data.images || []),
      ].filter(Boolean);

      products.push({
        name: data.name,
        brand: resolveBrand(data.brand, data.name),
        model: extractModel(data),
        price: parsePrice(data.price),
        params: cleanParams(data.parameters || {}),
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
  console.log('');

  // 品牌分布统计
  const brandDist: Record<string, number> = {};
  for (const p of products) {
    brandDist[p.brand] = (brandDist[p.brand] || 0) + 1;
  }
  console.log('📋 品牌分布:');
  Object.entries(brandDist)
    .sort((a, b) => b[1] - a[1])
    .forEach(([brand, count]) => console.log(`   ${brand}: ${count} 个`));
  console.log('');

  // 预览模式：到此结束
  if (DRY_RUN) {
    console.log('🔍 [预览模式] 未写入数据库');
    await pool.end();
    return;
  }

  // 4. 写入产品数据
  console.log('💾 写入产品数据...');
  let inserted = 0;
  let skipped = 0;
  let failed = 0;
  const productIdMap = new Map<string, number>(); // sourceUrl -> dbId

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

    // 进度
    if ((i + 1) % 50 === 0 || i + 1 === products.length) {
      console.log(`   ⌛ 进度: ${i + 1}/${products.length} (插入 ${inserted}, 跳过 ${skipped}, 失败 ${failed})`);
    }
  }

  console.log(`✅ 产品写入完成: 新增 ${inserted}, 更新 ${skipped}, 失败 ${failed}\n`);

  // 5. 写入图片关联
  console.log('🖼️  写入图片关联...');
  let imgInserted = 0;
  let imgSkipped = 0;

  for (const p of products) {
    const productId = productIdMap.get(p.sourceUrl);
    if (!productId || p.images.length === 0) continue;

    for (let idx = 0; idx < p.images.length; idx++) {
      const imgUrl = p.images[idx];
      const imageType = idx === 0 ? 'main' : 'gallery';
      try {
        await pool.query(
          `INSERT INTO product_images (product_id, image_url, image_type, sort_order, created_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (product_id, image_type, sort_order) DO UPDATE SET
             image_url = EXCLUDED.image_url`,
          [productId, imgUrl, imageType, idx]
        );
        imgInserted++;
      } catch (err) {
        imgSkipped++;
      }
    }
  }

  console.log(`✅ 图片关联完成: ${imgInserted} 写入, ${imgSkipped} 失败\n`);

  // 6. 更新搜索向量（如果有 search_vector 列）
  console.log('🔍 更新搜索向量...');
  try {
    await pool.query(`
      UPDATE products SET search_vector =
        to_tsvector('jiebacfg', coalesce(name, '') || ' ' || coalesce(brand, '') || ' ' || coalesce(model, ''))
      WHERE source_platform = $1 AND deleted_at IS NULL
    `, [SOURCE_PLATFORM]);
    console.log('✅ 搜索向量更新完成\n');
  } catch (err) {
    console.log(`⚠️  搜索向量更新跳过（可能未安装 pg_jieba）: ${(err as Error).message}\n`);
  }

  // 7. 最终统计
  const stats = await pool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(DISTINCT brand) as brands,
      COUNT(DISTINCT model) as models
    FROM products
    WHERE category_id = $1 AND deleted_at IS NULL
  `, [categoryId]);

  const imgStats = await pool.query(`
    SELECT COUNT(*) as total
    FROM product_images pi
    JOIN products p ON pi.product_id = p.id
    WHERE p.category_id = $1 AND p.deleted_at IS NULL
  `, [categoryId]);

  console.log('='.repeat(60));
  console.log('📊 导入统计:');
  console.log(`   空调产品总数: ${stats.rows[0].total}`);
  console.log(`   品牌数量: ${stats.rows[0].brands}`);
  console.log(`   型号数量: ${stats.rows[0].models}`);
  console.log(`   图片数量: ${imgStats.rows[0].total}`);
  console.log('='.repeat(60));

  // 品牌统计
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
