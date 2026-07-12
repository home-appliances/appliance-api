/**
 * 批量导入爬虫数据
 * 从 JSON 文件导入产品数据和图片到数据库
 *
 * 运行: npx tsx src/db/import-crawler-data.ts
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'appliance_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres123',
});

// 配置
const DATA_DIR = 'C:\\Users\\20264\\Desktop\\My\\crawler\\da\\products';
const IMAGES_DIR = 'C:\\Users\\20264\\Desktop\\My\\crawler\\da\\images';
const CONCURRENCY = 5; // 并发处理数量
const BATCH_SIZE = 100; // 每批插入数量

// 品牌名称映射（英文 -> 中文）
const brandNameMap: Record<string, string> = {
  'gree': '格力', 'haier': '海尔', 'midea': '美的', 'panasonic': '松下',
  'siemens': '西门子', 'samsung': '三星', 'hisense': '海信', 'rongsheng': '容声',
  'casarte': '卡萨帝', 'electrolux': '伊莱克斯', 'whirlpool': '惠而浦',
  'bosch': '博世', 'tcl': 'TCL', 'chigo': '志高', 'xinfei': '新飞',
  'mitsubishi': '三菱', 'aux': '奥克斯', 'lg': 'LG', 'daikin': '大金',
  'kelon': '科龙', 'little_swan': '小天鹅', 'skyworth': '创维',
  'noritz': '能率', 'macro': '万和', 'ariston': '阿里斯顿',
  'sony': '索尼', 'sharp': '夏普', 'philips': '飞利浦', 'changhong': '长虹',
  'konka': '康佳', 'letv': '乐视', 'huawei': '华为',
  'robam': '老板', 'fotile': '方太', 'vatti': '华帝',
  'xiaomi': '小米', 'chunlan': '春兰', 'galanz': '格兰仕',
};

// 产品类型分类映射
const categoryMap: Record<string, string> = {
  '空调': 'air_condition', '中央空调': 'air_condition', '挂机': 'air_condition', '柜机': 'air_condition',
  '冰箱': 'icebox', '冰柜': 'icebox', '冷柜': 'icebox',
  '洗衣机': 'washer', '滚筒洗衣机': 'washer', '波轮洗衣机': 'washer',
  '热水器': 'gas_water', '燃气热水器': 'gas_water', '电热水器': 'gas_water',
  '电视': 'lcd_tv', '液晶电视': 'lcd_tv', '智能电视': 'lcd_tv',
  '取暖器': 'heater', '暖风机': 'heater', '油汀': 'heater',
  '电饭煲': 'rice_cooker', '电饭锅': 'rice_cooker',
};

/**
 * 读取目录下所有 JSON 文件
 */
function getAllJsonFiles(dir: string): string[] {
  const files: string[] = [];

  const brands = fs.readdirSync(dir);
  for (const brand of brands) {
    const brandDir = path.join(dir, brand);
    if (!fs.statSync(brandDir).isDirectory()) continue;

    const jsonFiles = fs.readdirSync(brandDir).filter(f => f.endsWith('.json'));
    for (const file of jsonFiles) {
      files.push(path.join(brandDir, file));
    }
  }

  return files;
}

/**
 * 解析产品数据
 */
function parseProductData(filePath: string): any | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    // 提取分类
    let category = 'air_condition'; // 默认空调
    for (const [key, cat] of Object.entries(categoryMap)) {
      if (data.ac_type?.includes(key) || data.product_name?.includes(key)) {
        category = cat;
        break;
      }
    }

    // 构建参数对象
    const params: Record<string, any> = {
      '产品类别': data.ac_type || '空调',
      '空调类型': data.ac_type,
      '匹数': data.capacity,
      '适用面积': data.area,
      '冷暖类型': data.cooling_type,
      '变频/定频': data.frequency,
      '能效等级': data.energy_class,
      '能效比SEER': data.energy_ratio,
      '制冷剂': data.refrigerant,
      '制冷量': data.cooling_capacity,
      '制冷功率': data.cooling_power,
      '制热量': data.heating_capacity,
      '制热功率': data.heating_power,
      '循环风量': data.air_volume,
      '室内机噪音': data.indoor_noise,
      '室外机噪音': data.outdoor_noise,
      '室内机尺寸': data.indoor_size,
      '室外机尺寸': data.outdoor_size,
      '室内机重量': data.indoor_weight,
      '室外机重量': data.outdoor_weight,
      '电源规格': data.power_spec,
      'WiFi智能控制': data.wifi,
      '自清洁功能': data.self_clean,
      '除湿功能': data.dehumidify,
      '睡眠模式': data.sleep_mode,
    };

    // 清理空值
    Object.keys(params).forEach(key => {
      if (params[key] === null || params[key] === undefined || params[key] === '') {
        delete params[key];
      }
    });

    return {
      uid: data.product_id || data.source_url,
      name: data.product_name,
      brand: data.brand_en || data.brand,
      brand_cn: brandNameMap[data.brand] || data.brand,
      model: data.model,
      category,
      params,
      source_url: data.detail_url,
      image_info: data.main_image ? { url: data.main_image, local_path: null } : null,
    };

  } catch (error) {
    console.error(`❌ 解析失败: ${filePath}`, (error as Error).message);
    return null;
  }
}

/**
 * 下载图片
 */
async function downloadImage(url: string): Promise<Buffer | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);

  } catch (error) {
    return null;
  }
}

/**
 * 读取本地图片文件
 */
function readLocalImage(localPath: string): Buffer | null {
  try {
    if (fs.existsSync(localPath)) {
      return fs.readFileSync(localPath);
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * 批量插入产品
 */
async function batchInsertProducts(products: any[]): Promise<Map<string, number>> {
  const uidMap = new Map<string, number>();

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    const values: any[] = [];
    const placeholders: string[] = [];

    batch.forEach((p, index) => {
      const offset = index * 9;
      placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`);
      values.push(
        p.name,
        p.brand_cn,
        p.category,
        p.model,
        JSON.stringify(p.params),
        p.source_url,
        'zol',
        new Date(),
        new Date()
      );
    });

    const query = `
      INSERT INTO products (name, brand, category, model, params, source_url, source_platform, created_at, updated_at)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (source_url) DO UPDATE SET
        name = EXCLUDED.name,
        params = EXCLUDED.params,
        updated_at = NOW()
      RETURNING id, source_url
    `;

    try {
      const result = await pool.query(query, values);
      for (const row of result.rows) {
        // 从 source_url 反推 uid
        const product = batch.find(p => p.source_url === row.source_url);
        if (product) {
          uidMap.set(product.uid, row.id);
        }
      }
    } catch (error) {
      console.error(`❌ 批量插入失败:`, (error as Error).message);
      // 降级为单条插入
      for (const p of batch) {
        try {
          const result = await pool.query(`
            INSERT INTO products (name, brand, category, model, params, source_url, source_platform, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (source_url) DO UPDATE SET
              name = EXCLUDED.name,
              params = EXCLUDED.params,
              updated_at = NOW()
            RETURNING id
          `, [p.name, p.brand_cn, p.category, p.model, JSON.stringify(p.params), p.source_url, 'zol', new Date(), new Date()]);

          uidMap.set(p.uid, result.rows[0].id);
        } catch (e) {
          console.error(`❌ 插入失败: ${p.name}`, (e as Error).message);
        }
      }
    }
  }

  return uidMap;
}

/**
 * 批量导入图片(5路并发 + 批量去重)
 */
async function batchImportImages(products: any[], uidMap: Map<string, number>): Promise<number> {
  let imported = 0;
  const CONCURRENCY = 5;

  const queue = products.filter(p => uidMap.has(p.uid) && p.image_info?.url);
  if (!queue.length) return 0;

  // 批量查询已存在图片
  const urls = [...new Set(queue.map(p => p.image_info.url))];
  const existingResult = await pool.query(
    'SELECT source_url, id FROM images WHERE source_url = ANY($1)', [urls]
  );
  const existingMap = new Map(existingResult.rows.map(r => [r.source_url, r.id]));
  console.log(`📸 待下载 ${queue.length} 张, 已存在 ${existingMap.size} 张`);

  for (let i = 0; i < queue.length; i += CONCURRENCY) {
    const batch = queue.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (p) => {
        const productId = uidMap.get(p.uid)!;
        const url = p.image_info.url;

        // 已存在则直接关联
        if (existingMap.has(url)) {
          await pool.query('UPDATE products SET image_id = $1 WHERE id = $2', [existingMap.get(url), productId]);
          return 'existing';
        }

        const buf = await downloadImage(url);
        if (!buf) return 'fail';

        const r = await pool.query(
          `INSERT INTO images (image_data, mime_type, file_size, source_url, created_at)
           VALUES ($1, 'image/jpeg', $2, $3, NOW()) RETURNING id`,
          [buf, buf.length, url]);
        await pool.query('UPDATE products SET image_id = $1 WHERE id = $2', [r.rows[0].id, productId]);
        existingMap.set(url, r.rows[0].id);
        return 'new';
      })
    );
    imported += results.filter(r => r.status === 'fulfilled' && r.value !== 'fail').length;

    if ((i + CONCURRENCY) % 500 <= CONCURRENCY) {
      console.log(`  ⌛ 图片进度: ${Math.min(i + CONCURRENCY, queue.length)}/${queue.length}`);
    }
  }
  console.log(`  ✅ 图片导入: ${imported} 张`);
  return imported;
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始批量导入爬虫数据\n');
  console.log(`📁 数据目录: ${DATA_DIR}`);
  console.log(`📁 图片目录: ${IMAGES_DIR}\n`);

  // 1. 获取所有 JSON 文件
  const jsonFiles = getAllJsonFiles(DATA_DIR);
  console.log(`📊 找到 ${jsonFiles.length} 个产品文件\n`);

  if (jsonFiles.length === 0) {
    console.log('❌ 没有找到数据文件');
    await pool.end();
    return;
  }

  // 2. 解析所有产品数据
  console.log('📦 解析产品数据...');
  const products: any[] = [];
  let parseErrors = 0;

  for (const file of jsonFiles) {
    const product = parseProductData(file);
    if (product) {
      products.push(product);
    } else {
      parseErrors++;
    }
  }

  console.log(`✅ 解析完成: ${products.length} 成功, ${parseErrors} 失败\n`);

  // 3. 批量插入产品
  console.log('💾 插入产品数据...');
  const uidMap = await batchInsertProducts(products);
  console.log(`✅ 产品插入完成: ${uidMap.size} 条记录\n`);

  // 4. 批量导入图片
  console.log('🖼️  导入图片...');
  const imageCount = await batchImportImages(products, uidMap);
  console.log(`✅ 图片导入完成: ${imageCount} 张\n`);

  // 5. 统计结果
  const stats = await pool.query(`
    SELECT
      COUNT(*) as total_products,
      COUNT(image_id) as with_images,
      COUNT(*) - COUNT(image_id) as without_images
    FROM products
  `);

  const imageStats = await pool.query('SELECT COUNT(*) as total_images FROM images');

  console.log('='.repeat(60));
  console.log('📊 导入统计:');
  console.log(`   产品总数: ${stats.rows[0].total_products}`);
  console.log(`   有图片: ${stats.rows[0].with_images}`);
  console.log(`   无图片: ${stats.rows[0].without_images}`);
  console.log(`   图片总数: ${imageStats.rows[0].total_images}`);
  console.log('='.repeat(60));

  // 6. 按品牌统计
  const brandStats = await pool.query(`
    SELECT brand, COUNT(*) as count
    FROM products
    GROUP BY brand
    ORDER BY count DESC
    LIMIT 20
  `);

  console.log('\n📋 前 20 品牌统计:');
  for (const row of brandStats.rows) {
    console.log(`   ${row.brand}: ${row.count} 个产品`);
  }

  await pool.end();
  console.log('\n✨ 导入完成！');
}

// 运行
main().catch((error) => {
  console.error('❌ 执行失败:', error);
  process.exit(1);
});
