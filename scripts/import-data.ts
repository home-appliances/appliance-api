/**
 * 数据导入脚本
 * 将 crawler/da/products 下的 JSON 数据导入到 PostgreSQL 数据库
 */

import pg from 'pg';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { pinyin } from 'pinyin-pro';

dotenv.config();

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'appliance_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres123',
  max: 10,
});

// 产品分类映射
const categoryMap: Record<string, string> = {
  'icebox': '冰箱',
  'air_condition': '空调',
  'washer': '洗衣机',
  'gas_water': '燃气热水器',
  'central_water': '空气能热水器',
  'heater': '取暖器',
  'lcd_tv': '电视',
  'rice_cooker': '电饭煲/厨电',
};

// 源数据中的类型到分类代码的映射
function inferCategory(product: any): string {
  const name = (product.product_name || '').toLowerCase();
  const model = (product.model || '').toLowerCase();
  const detailUrl = (product.detail_url || '').toLowerCase();

  // 从 URL 推断分类
  if (detailUrl.includes('/air_condition/') || detailUrl.includes('/kongtiao/')) return 'air_condition';
  if (detailUrl.includes('/icebox/') || detailUrl.includes('/bingxiang/')) return 'icebox';
  if (detailUrl.includes('/washer/') || detailUrl.includes('/xiyiji/')) return 'washer';
  if (detailUrl.includes('/water_heater/') || detailUrl.includes('/reshuiqi/')) return 'gas_water';
  if (detailUrl.includes('/tv/') || detailUrl.includes('/dianshi/')) return 'lcd_tv';
  if (detailUrl.includes('/rice_cooker/') || detailUrl.includes('/dianfanbao/')) return 'rice_cooker';
  if (detailUrl.includes('/heater/') || detailUrl.includes('/qunuanqi/')) return 'heater';

  // 从产品名称推断分类
  if (name.includes('空调') || name.includes('挂机') || name.includes('柜机') || model.startsWith('kfr')) return 'air_condition';
  if (name.includes('冰箱') || name.includes('冰柜') || name.includes('冷柜')) return 'icebox';
  if (name.includes('洗衣机') || name.includes('滚筒') || name.includes('波轮')) return 'washer';
  if (name.includes('热水器') || name.includes('燃气')) return 'gas_water';
  if (name.includes('电视') || name.includes('液晶')) return 'lcd_tv';
  if (name.includes('电饭煲') || name.includes('电饭锅') || name.includes('压力锅')) return 'rice_cooker';
  if (name.includes('取暖器') || name.includes('暖风机') || name.includes('油汀')) return 'heater';

  // 默认归类为空调（因为爬虫主要抓取空调数据）
  return 'air_condition';
}

// 获取拼音
function getPinyin(text: string): string {
  if (!text) return '';
  try {
    return pinyin(text, { toneType: 'none', type: 'array' }).join('');
  } catch {
    return '';
  }
}

// 获取拼音首字母
function getPinyinInitials(text: string): string {
  if (!text) return '';
  try {
    return pinyin(text, { pattern: 'first', toneType: 'none', type: 'array' }).join('');
  } catch {
    return '';
  }
}

// 清理 HTML 实体
function cleanHtmlEntities(text: string): string {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// 从代理 URL 中提取真实图片地址
function extractRealImageUrl(url: string): string {
  if (!url) return url;

  // 处理 http://localhost:3000/api/image-proxy?url=xxx 格式
  if (url.includes('localhost:3000/api/image-proxy?url=')) {
    try {
      const urlObj = new URL(url);
      const realUrl = urlObj.searchParams.get('url');
      if (realUrl) {
        return decodeURIComponent(realUrl);
      }
    } catch {
      // 解析失败，返回原 URL
    }
  }

  return url;
}

// 下载图片并转换为 Buffer
async function downloadImage(url: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  if (!url || url.startsWith('data:')) return null;

  // 提取真实图片 URL
  const realUrl = extractRealImageUrl(url);

  try {
    const response = await fetch(realUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.pconline.com.cn/',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return { buffer, mimeType: contentType.split(';')[0].trim() };
  } catch (error) {
    failedImages.push(realUrl);
    console.warn(`  ⚠️ 下载图片失败: ${realUrl}`);
    return null;
  }
}

// 将源数据转换为 products 表格式
function transformProduct(data: any, imageUrl: string, realImageUrl: string): any {
  const category = inferCategory(data);
  const productName = cleanHtmlEntities(data.product_name || data.model || '');
  const searchName = `${data.brand || ''} ${productName}`;

  // 构建 params JSONB
  const params: Record<string, string> = {};

  // 基本信息
  if (data.ac_type) params['产品类型'] = data.ac_type;
  if (data.capacity) params['匹数'] = data.capacity;
  if (data.area) params['适用面积'] = data.area;
  if (data.cooling_type) params['冷暖类型'] = data.cooling_type;
  if (data.frequency) params['变频/定频'] = data.frequency;
  if (data.energy_class) params['能效等级'] = data.energy_class;
  if (data.energy_ratio) params['能效比'] = data.energy_ratio;

  // 性能参数
  if (data.cooling_capacity) params['制冷量'] = data.cooling_capacity;
  if (data.cooling_power) params['制冷功率'] = data.cooling_power;
  if (data.heating_capacity) params['制热量'] = data.heating_capacity;
  if (data.heating_power) params['制热功率'] = data.heating_power;
  if (data.air_volume) params['循环风量'] = data.air_volume;

  // 噪音
  if (data.indoor_noise) params['室内机噪音'] = data.indoor_noise;
  if (data.outdoor_noise) params['室外机噪音'] = data.outdoor_noise;

  // 尺寸重量
  if (data.indoor_size) params['室内机尺寸'] = data.indoor_size;
  if (data.outdoor_size) params['室外机尺寸'] = data.outdoor_size;
  if (data.indoor_weight) params['室内机重量'] = data.indoor_weight;
  if (data.outdoor_weight) params['室外机重量'] = data.outdoor_weight;

  // 其他参数
  if (data.color) params['颜色'] = data.color;
  if (data.power_spec) params['电源规格'] = data.power_spec;
  if (data.control_method) params['控制方式'] = data.control_method;
  if (data.refrigerant) params['制冷剂'] = data.refrigerant;
  if (data.compressor) params['压缩机'] = data.compressor;
  if (data.series) params['系列'] = data.series;

  // 功能特性
  if (data.wifi) params['WiFi'] = data.wifi;
  if (data.self_clean) params['自清洁'] = data.self_clean;
  if (data.sterilize) params['杀菌'] = data.sterilize;
  if (data.dehumidify) params['除湿'] = data.dehumidify;
  if (data.sleep_mode) params['睡眠模式'] = data.sleep_mode;

  // 添加产品类别
  params['产品类别'] = categoryMap[category] || '空调';

  return {
    name: productName,
    brand: (data.brand || '').toLowerCase(),
    model: data.model || '',
    price: data.price_jd || data.price_tmall || data.price || null,
    rating: null,
    category,
    params,
    images: realImageUrl ? [realImageUrl] : [],
    source_url: data.detail_url || '',
    pinyin: getPinyin(searchName),
    pinyin_initials: getPinyinInitials(searchName),
  };
}

// 主函数
async function main() {
  const client = await pool.connect();

  try {
    console.log('🚀 开始数据导入...\n');

    // 1. 清除现有数据
    console.log('🗑️  清除现有数据...');
    await client.query('DELETE FROM search_logs');
    await client.query('DELETE FROM products');
    await client.query('DELETE FROM images');
    await client.query('DELETE FROM categories');
    console.log('  ✅ 已清除所有表数据\n');

    // 2. 插入分类数据
    console.log('📁 插入分类数据...');
    for (const [code, name] of Object.entries(categoryMap)) {
      await client.query(
        'INSERT INTO categories (code, name, is_active, sort_order) VALUES ($1, $2, true, $3)',
        [code, name, Object.keys(categoryMap).indexOf(code)]
      );
    }
    console.log(`  ✅ 已插入 ${Object.keys(categoryMap).length} 个分类\n`);

    // 3. 读取并导入产品数据
    const productsDir = 'C:\\Users\\20264\\Desktop\\My\\crawler\\da\\products';
    const brandDirs = await fs.readdir(productsDir);

    let totalImported = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    let imageDownloadCount = 0;
    const failedImages: string[] = [];

    for (const brandDir of brandDirs) {
      const brandPath = path.join(productsDir, brandDir);
      const stat = await fs.stat(brandPath);

      if (!stat.isDirectory()) continue;

      console.log(`\n📦 处理品牌: ${brandDir}`);
      const files = await fs.readdir(brandPath);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      let brandCount = 0;

      for (const file of jsonFiles) {
        try {
          const filePath = path.join(brandPath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const data = JSON.parse(content);

          // 下载图片
          let imageData: { buffer: Buffer; mimeType: string } | null = null;
          let imageUrl = data.main_image || '';

          // 提取真实图片 URL（用于存储和下载）
          const realImageUrl = extractRealImageUrl(imageUrl);

          if (imageUrl) {
            imageData = await downloadImage(imageUrl);
            if (imageData) {
              imageDownloadCount++;
            }
          }

          // 插入图片记录
          let imageId: number | null = null;
          if (imageData) {
            const imgResult = await client.query(
              'INSERT INTO images (image_data, mime_type) VALUES ($1, $2) RETURNING id',
              [imageData.buffer, imageData.mimeType]
            );
            imageId = imgResult.rows[0].id;
          }

          // 转换产品数据
          const product = transformProduct(data, imageUrl, realImageUrl);

          // 插入产品记录
          const result = await client.query(`
            INSERT INTO products (
              name, brand, model, price, rating, category, category_id,
              params, images, image_id, source_url, pinyin, pinyin_initials,
              search_vector, created_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6,
              (SELECT id FROM categories WHERE code = $6),
              $7, $8, $9, $10, $11, $12,
              to_tsvector('simple', $1 || ' ' || $2 || ' ' || $3 || ' ' || $11 || ' ' || $12),
              NOW()
            )
          `, [
            product.name,
            product.brand,
            product.model,
            product.price,
            product.rating,
            product.category,
            JSON.stringify(product.params),
            product.images,
            imageId,
            product.source_url,
            product.pinyin,
            product.pinyin_initials,
          ]);

          totalImported++;
          brandCount++;
        } catch (error) {
          totalErrors++;
          console.error(`  ❌ 导入失败 ${file}: ${(error as Error).message}`);
        }
      }

      console.log(`  ✅ ${brandDir}: ${brandCount} 条`);
    }

    // 4. 更新 search_vector 字段
    console.log('\n🔍 更新全文搜索索引...');
    await client.query(`
      UPDATE products SET search_vector =
        to_tsvector('simple',
          coalesce(name, '') || ' ' ||
          coalesce(brand, '') || ' ' ||
          coalesce(model, '') || ' ' ||
          coalesce(pinyin, '') || ' ' ||
          coalesce(pinyin_initials, '')
        )
    `);
    console.log('  ✅ 全文搜索索引已更新');

    // 5. 显示统计信息
    console.log('\n📊 导入完成统计:');
    console.log(`  - 成功导入: ${totalImported} 条`);
    console.log(`  - 跳过: ${totalSkipped} 条`);
    console.log(`  - 错误: ${totalErrors} 条`);
    console.log(`  - 图片下载: ${imageDownloadCount} 张`);
    console.log(`  - 图片失败: ${failedImages.length} 张`);

    if (failedImages.length > 0) {
      console.log('\n❌ 下载失败的图片列表:');
      failedImages.forEach((url, index) => {
        console.log(`  ${index + 1}. ${url}`);
      });
    }

    // 查询各分类产品数量
    const categoryStats = await client.query(`
      SELECT c.name, COUNT(p.id) as count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id, c.name
      ORDER BY count DESC
    `);

    console.log('\n📦 各分类产品数量:');
    for (const row of categoryStats.rows) {
      console.log(`  - ${row.name}: ${row.count} 条`);
    }

  } catch (error) {
    console.error('❌ 导入失败:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// 运行
main().catch(console.error);
