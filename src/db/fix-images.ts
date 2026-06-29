/**
 * 为缺少 pconline 图片的产品重新爬取图片
 */
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'appliance_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres123',
});

// 从 source_url 提取产品信息，构建 pconline 图片 URL
function buildImageUrl(sourceUrl: string): string | null {
  if (!sourceUrl) return null;

  // source_url 格式: //product.pconline.com.cn/icebox/brand/id.html
  // 图片 URL 格式: https://img4.pconline.com.cn/pconline/images/product/YYYYMMDD/id_sn8.jpg
  // 我们需要从 source_url 中提取 brand 和 id，然后尝试常见的图片路径

  const match = sourceUrl.match(/\/(\d+)\.html/);
  if (!match) return null;

  const productId = match[1];
  // 尝试构建一个可能的图片 URL（这只是一个占位，实际需要爬取）
  return null;
}

// 从 pconline 产品页面爬取图片
async function crawlImageFromPconline(sourceUrl: string): Promise<string[]> {
  const images: string[] = [];

  try {
    // 补全 URL
    let url = sourceUrl;
    if (url.startsWith('//')) {
      url = 'https:' + url;
    }

    console.log(`  正在爬取: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      }
    });

    if (!response.ok) {
      console.log(`  请求失败: ${response.status}`);
      return images;
    }

    const html = await response.text();

    // 匹配 pconline 产品图片
    // 格式: //img4.pconline.com.cn/pconline/images/product/xxx.jpg
    const imgRegex = /(?:https?:)?\/\/img\d*\.pconline\.com\.cn\/pconline\/images\/product\/[^"'\s]+\.(jpg|jpeg|png|webp)/gi;
    let match;

    while ((match = imgRegex.exec(html)) !== null) {
      let imgUrl = match[0];
      if (imgUrl.startsWith('//')) {
        imgUrl = 'https:' + imgUrl;
      }
      if (!images.includes(imgUrl)) {
        images.push(imgUrl);
      }
    }

    console.log(`  找到 ${images.length} 张图片`);

  } catch (error) {
    console.error(`  爬取失败:`, error);
  }

  return images;
}

async function fixImages() {
  try {
    console.log('连接数据库...');
    await pool.query('SELECT 1');
    console.log('数据库连接成功\n');

    // 找出没有 pconline 图片的产品
    const result = await pool.query(`
      SELECT id, name, brand, source_url, images
      FROM products
      WHERE NOT EXISTS (
        SELECT 1 FROM unnest(images) img
        WHERE img LIKE '%pconline.com.cn%'
        AND img NOT LIKE '%jingdong.png%'
        AND img NOT LIKE '%product/2111/04%'
        AND img NOT LIKE '%product-tof.png%'
      )
      AND source_url IS NOT NULL
      ORDER BY id
    `);

    console.log(`找到 ${result.rows.length} 个需要修复图片的产品\n`);

    let fixed = 0;
    let failed = 0;

    for (const product of result.rows) {
      console.log(`[${product.id}] ${product.brand} - ${product.name}`);

      const images = await crawlImageFromPconline(product.source_url);

      if (images.length > 0) {
        // 更新数据库，将新图片放在最前面
        const allImages = [...images, ...(product.images || [])];
        await pool.query(
          'UPDATE products SET images = $1 WHERE id = $2',
          [allImages, product.id]
        );
        console.log(`  ✅ 已更新 ${images.length} 张图片\n`);
        fixed++;
      } else {
        console.log(`  ❌ 未能爬取到图片\n`);
        failed++;
      }

      // 延迟 1 秒，避免请求过快
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`\n完成！修复: ${fixed} 个，失败: ${failed} 个`);

  } catch (error) {
    console.error('修复失败:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixImages();
