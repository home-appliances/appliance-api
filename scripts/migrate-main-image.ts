/**
 * 迁移脚本：为现有产品补全 main_image 字段
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
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const DRY_RUN = process.argv.includes('--dry');
const LIMIT = (() => {
  const idx = process.argv.indexOf('--limit');
  return idx >= 0 ? parseInt(process.argv[idx + 1]) : 0;
})();

async function ensureTable() {
  const tableCheck = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_name = 'images'
  `);
  if (tableCheck.rows.length === 0) {
    console.log('📝 创建 images 表...');
    await pool.query(`
      CREATE TABLE images (
        id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        image_data bytea,
        mime_type text,
        file_size integer,
        width integer,
        height integer,
        source_url text UNIQUE,
        created_at timestamp DEFAULT now() NOT NULL
      )
    `);
    console.log('✅ images 表已创建');
  }
}

async function ensureColumn() {
  const colCheck = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'main_image'
  `);
  if (colCheck.rows.length === 0) {
    console.log('📝 添加 main_image 列...');
    await pool.query('ALTER TABLE products ADD COLUMN main_image text');
    console.log('✅ main_image 列已添加');
  }

  const idColCheck = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'image_id'
  `);
  if (idColCheck.rows.length === 0) {
    console.log('📝 添加 image_id 列...');
    await pool.query('ALTER TABLE products ADD COLUMN image_id bigint');
    console.log('✅ image_id 列已添加');
  }
}

async function downloadImage(url: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  if (!url || url.startsWith('data:')) return null;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.pconline.com.cn/',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    let mimeType = contentType.split(';')[0].trim();

    if (!mimeType.startsWith('image/')) {
      const urlLower = url.toLowerCase();
      if (urlLower.endsWith('.png')) mimeType = 'image/png';
      else if (urlLower.endsWith('.gif')) mimeType = 'image/gif';
      else if (urlLower.endsWith('.webp')) mimeType = 'image/webp';
      else mimeType = 'image/jpeg';
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length < 1024) return null;

    return { buffer, mimeType };
  } catch {
    return null;
  }
}

async function main() {
  console.log(`🚀 main_image 迁移脚本启动 ${DRY_RUN ? '(试运行)' : ''}`);
  if (LIMIT > 0) console.log(`📊 限制处理前 ${LIMIT} 条`);

  await ensureTable();
  await ensureColumn();

  let query = `
    SELECT p.id, p.name, p.image_id
    FROM products p
    WHERE p.deleted_at IS NULL
      AND (p.main_image IS NULL OR p.main_image = '')
  `;
  const params: any[] = [];
  if (LIMIT > 0) {
    query += ' LIMIT $1';
    params.push(LIMIT);
  }
  query += ' ORDER BY p.id';

  const { rows: products } = await pool.query(query, params);
  console.log(`📦 找到 ${products.length} 个产品需要迁移\n`);

  let skipCount = 0;
  let directCount = 0;
  let downloadCount = 0;
  let failCount = 0;

  for (const product of products) {
    if (product.image_id) {
      const imgCheck = await pool.query(
        'SELECT id FROM images WHERE id = $1',
        [product.image_id]
      );
      if (imgCheck.rows.length > 0) {
        const mainUrl = `/api/image/${product.image_id}`;
        if (!DRY_RUN) {
          await pool.query(
            'UPDATE products SET main_image = $1 WHERE id = $2',
            [mainUrl, product.id]
          );
        }
        console.log(`✅ [${product.id}] 直接设置: ${mainUrl}`);
        directCount++;
        continue;
      }
    }

    const piResult = await pool.query(
      `SELECT image_url FROM product_images
       WHERE product_id = $1 AND image_url IS NOT NULL AND image_url != ''
       ORDER BY CASE image_type WHEN 'main' THEN 0 ELSE 1 END, sort_order, id
       LIMIT 1`,
      [product.id]
    );

    let imageUrl: string | null = null;
    if (piResult.rows.length > 0) {
      imageUrl = piResult.rows[0].image_url;
    }

    if (!imageUrl) {
      console.log(`⏭️ [${product.id}] ${product.name}: 无图片URL，跳过`);
      skipCount++;
      continue;
    }

    console.log(`📥 [${product.id}] ${product.name}: 下载 ${imageUrl.substring(0, 80)}...`);
    const imageData = await downloadImage(imageUrl);

    if (!imageData) {
      console.log(`   ❌ 下载失败，使用原始URL作为main_image`);
      if (!DRY_RUN) {
        await pool.query(
          'UPDATE products SET main_image = $1 WHERE id = $2',
          [imageUrl, product.id]
        );
      }
      failCount++;
      continue;
    }

    if (!DRY_RUN) {
      const imgResult = await pool.query(
        `INSERT INTO images (image_data, mime_type, file_size, source_url, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (source_url) DO UPDATE SET image_data = EXCLUDED.image_data
         RETURNING id`,
        [imageData.buffer, imageData.mimeType, imageData.buffer.length, imageUrl]
      );
      const imageId = imgResult.rows[0].id;

      await pool.query(
        'UPDATE products SET main_image = $1, image_id = $2 WHERE id = $3',
        [`/api/image/${imageId}`, imageId, product.id]
      );
    }

    console.log(`   ✅ 已下载 ${(imageData.buffer.length / 1024).toFixed(1)} KB 并入库`);
    downloadCount++;

    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log('📊 迁移统计:');
  console.log(`  - 直接设置(image_id 已有): ${directCount}`);
  console.log(`  - 下载并入库: ${downloadCount}`);
  console.log(`  - 跳过(无图片): ${skipCount}`);
  console.log(`  - 下载失败(使用原始URL): ${failCount}`);
  console.log(`  - 总计: ${products.length}`);

  const totalResult = await pool.query('SELECT COUNT(*) FROM products WHERE deleted_at IS NULL');
  const withImageResult = await pool.query(
    'SELECT COUNT(*) FROM products WHERE deleted_at IS NULL AND main_image IS NOT NULL AND main_image != \'\''
  );
  console.log(`\n📊 数据库统计:`);
  console.log(`  - 产品总数: ${totalResult.rows[0].count}`);
  console.log(`  - 有 main_image: ${withImageResult.rows[0].count}`);
  const pct = ((parseInt(withImageResult.rows[0].count) / parseInt(totalResult.rows[0].count)) * 100).toFixed(1);
  console.log(`  - 覆盖率: ${pct}%`);

  await pool.end();
}

main().catch(err => {
  console.error('❌ 迁移失败:', err);
  process.exit(1);
});
