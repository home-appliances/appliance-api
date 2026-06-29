/**
 * 多源数据融合脚本
 * 功能：去重、合并、标准化
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'appliance_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres123',
  max: 10,
});

// =====================================================
// 标准化函数
// =====================================================

/**
 * 标准化品牌名称
 */
function normalizeBrand(brand: string): string {
  if (!brand) return '';

  const brandMap: Record<string, string> = {
    // 中文 -> 英文
    '格力': 'gree', '美的': 'midea', '海尔': 'haier', '奥克斯': 'aux',
    'TCL': 'tcl', '海信': 'hisense', '松下': 'panasonic', '三菱电机': 'mitsubishi',
    '大金': 'daikin', '科龙': 'kelon', '志高': 'chigo', '小米': 'xiaomi',
    '长虹': 'changhong', '康佳': 'konka', '飞利浦': 'philips', '创维': 'skyworth',
    '西门子': 'siemens', '三星': 'samsung', 'LG': 'lg', '索尼': 'sony',
    '富士通将军': 'fujitsugeneral', '东芝': 'toshiba', '惠而浦': 'whirlpool',
    '方太': 'fotile', '老板': 'robam', '华帝': 'vatti', '万和': 'vanward',
    '万家乐': 'macro', '林内': 'noritz', '能率': 'noritz', 'A.O.史密斯': 'a_o_smith',
    '阿里斯顿': 'ariston', '博世': 'bosch', '帅康': 'sacon', '樱花': 'sakura',
    '康宝': 'canbo', '火王': 'firewang', '苏泊尔': 'supor', '九阳': 'joyoung',
    '爱仕达': 'asder', '新飞': 'xinfei', '容声': 'rongsheng', '美菱': 'meiling',
    '卡萨帝': 'casarte', '小天鹅': 'little_swan', '三洋': 'sanyo',
  };

  // 先尝试直接匹配
  if (brandMap[brand]) {
    return brandMap[brand];
  }

  // 尝试小写匹配
  const lowerBrand = brand.toLowerCase();
  if (brandMap[lowerBrand]) {
    return brandMap[lowerBrand];
  }

  // 尝试去除空格后匹配
  const trimmed = brand.trim();
  if (brandMap[trimmed]) {
    return brandMap[trimmed];
  }

  return lowerBrand;
}

/**
 * 标准化型号
 */
function normalizeModel(model: string): string {
  if (!model) return '';

  // 去除多余空格
  let normalized = model.replace(/\s+/g, '').trim();

  // 统一括号格式
  normalized = normalized.replace(/（/g, '(').replace(/）/g, ')');

  // 去除型号中的中文描述
  normalized = normalized.replace(/(变频|定频|冷暖|单冷|一级能效|二级能效|三级能效)/g, '');

  return normalized;
}

/**
 * 标准化能效等级
 */
function normalizeEnergyLevel(value: string): string {
  if (!value) return '';

  const match = value.match(/(一级|二级|三级|四级|五级|1级|2级|3级|4级|5级|A\+\+\+|A\+\+|A\+|A|B|C|D)/i);
  if (match) {
    const level = match[1];
    // 统一为中文
    if (/^[1-5]$/.test(level)) {
      const map: Record<string, string> = { '1': '一级', '2': '二级', '3': '三级', '4': '四级', '5': '五级' };
      return map[level];
    }
    return level;
  }

  return value;
}

/**
 * 标准化尺寸格式
 */
function normalizeSize(value: string): string {
  if (!value) return '';

  // 统一宽x高x深格式
  let normalized = value.replace(/[×X*]/g, 'x');

  // 确保单位一致
  if (!normalized.includes('mm') && !normalized.includes('cm') && !normalized.includes('m')) {
    // 如果只有数字，添加mm单位
    if (/^\d+(\.\d+)?x\d+(\.\d+)?x\d+(\.\d+)?$/.test(normalized)) {
      normalized += 'mm';
    }
  }

  return normalized;
}

// =====================================================
// 生成唯一键（用于去重）
// =====================================================

function generateProductKey(product: any): string {
  const brand = normalizeBrand(product.brand || '');
  const model = normalizeModel(product.model || '');

  if (brand && model) {
    return `${brand}_${model}`;
  }

  // 如果没有型号，使用名称
  const name = (product.name || '').toLowerCase().replace(/\s+/g, '');
  if (name) {
    return `name_${name}`;
  }

  return `id_${product.id}`;
}

// =====================================================
// 合并两个产品记录
// =====================================================

function mergeProducts(existing: any, newProduct: any): any {
  const merged = { ...existing };

  // 更新基本信息
  if (newProduct.name && (!merged.name || newProduct.name.length > merged.name.length)) {
    merged.name = newProduct.name;
  }

  if (newProduct.model && (!merged.model || newProduct.model.length > merged.model.length)) {
    merged.model = newProduct.model;
  }

  // 更新图片（合并去重）
  const existingImages = merged.images || [];
  const newImages = newProduct.images || [];
  merged.images = [...new Set([...existingImages, ...newImages])].slice(0, 20);

  // 合并参数（新数据源的参数优先）
  if (newProduct.params && Object.keys(newProduct.params).length > 0) {
    merged.params = {
      ...(merged.params || {}),
      ...newProduct.params,
    };
  }

  // 更新价格（取最新或更高价）
  if (newProduct.price && (!merged.price || newProduct.price > merged.price)) {
    merged.price = newProduct.price;
  }

  // 更新数据源信息
  merged.last_crawled_at = new Date();

  return merged;
}

// =====================================================
// 主融合函数
// =====================================================

async function mergeDataSources() {
  console.log('🔄 开始多源数据融合...\n');

  try {
    // 1. 获取所有现有产品
    console.log('📥 获取现有产品数据...');
    const existingResult = await pool.query('SELECT * FROM products');
    const existingProducts = existingResult.rows;

    // 2. 建立索引（按 brand_model 去重键）
    const productIndex = new Map<string, any>();
    for (const product of existingProducts) {
      const key = generateProductKey(product);
      productIndex.set(key, product);
    }

    console.log(`   现有产品: ${existingProducts.length}`);
    console.log(`   去重后唯一产品: ${productIndex.size}\n`);

    // 3. 统计信息
    const stats = {
      totalExisting: existingProducts.length,
      uniqueProducts: productIndex.size,
      duplicates: existingProducts.length - productIndex.size,
      sources: {} as Record<string, number>,
    };

    // 统计各数据源数量
    for (const product of existingProducts) {
      const source = product.source_platform || 'unknown';
      stats.sources[source] = (stats.sources[source] || 0) + 1;
    }

    // 4. 输出统计
    console.log('📊 融合统计:');
    console.log(`   总产品数: ${stats.totalExisting}`);
    console.log(`   唯一产品数: ${stats.uniqueProducts}`);
    console.log(`   重复产品数: ${stats.duplicates}`);
    console.log('\n   数据来源分布:');
    for (const [source, count] of Object.entries(stats.sources)) {
      console.log(`     ${source}: ${count}`);
    }

    // 5. 更新数据库中的重复数据
    console.log('\n🔄 合并重复产品...');

    // 按去重键分组
    const grouped = new Map<string, any[]>();
    for (const product of existingProducts) {
      const key = generateProductKey(product);
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(product);
    }

    let mergedCount = 0;
    let deletedCount = 0;

    for (const [key, products] of grouped) {
      if (products.length > 1) {
        // 有重复，需要合并
        let merged = products[0];
        for (let i = 1; i < products.length; i++) {
          merged = mergeProducts(merged, products[i]);
        }

        // 更新第一条记录
        await pool.query(
          `UPDATE products SET
            name = $1,
            model = $2,
            images = $3,
            params = $4,
            price = $5,
            last_crawled_at = $6
          WHERE id = $7`,
          [merged.name, merged.model, merged.images, merged.params, merged.price, merged.last_crawled_at, merged.id]
        );

        // 删除其他重复记录
        for (let i = 1; i < products.length; i++) {
          await pool.query('DELETE FROM products WHERE id = $1', [products[i].id]);
          deletedCount++;
        }

        mergedCount++;
      }
    }

    console.log(`   合并了 ${mergedCount} 组重复产品`);
    console.log(`   删除了 ${deletedCount} 条重复记录\n`);

    // 6. 标准化处理
    console.log('📐 标准化数据...');

    // 标准化能效等级
    const updateEnergy = await pool.query(`
      UPDATE products
      SET params = jsonb_set(
        params,
        '{能效等级}',
        to_jsonb(CASE
          WHEN params->>'能效等级' ~ '^[1-5]$' THEN
            CASE params->>'能效等级'
              WHEN '1' THEN '一级能效'
              WHEN '2' THEN '二级能效'
              WHEN '3' THEN '三级能效'
              WHEN '4' THEN '四级能效'
              WHEN '5' THEN '五级能效'
            END
          WHEN params->>'能效等级' ~ '一级' THEN '一级能效'
          WHEN params->>'能效等级' ~ '二级' THEN '二级能效'
          WHEN params->>'能效等级' ~ '三级' THEN '三级能效'
          ELSE params->>'能效等级'
        END::text)
      )
      WHERE params->>'能效等级' IS NOT NULL
    `);
    console.log(`   更新了 ${updateEnergy.rowCount} 条记录的能效等级`);

    console.log('\n✅ 数据融合完成！');

  } catch (error) {
    console.error('❌ 融合失败:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// 运行
mergeDataSources();
