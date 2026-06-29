/**
 * 数据库写入器
 * 遵循 supabase-postgres-best-practices: 连接池、参数化查询、批量插入
 * 遵循 security-best-practices: 不记录敏感信息
 */

import pg from 'pg';
import { config } from './config';
import { Product, ImageData } from './types';
import { logDatabaseConnection, logDatabaseWrite, logDatabaseWriteFailed, logError } from './logger';

const { Pool } = pg;

// =====================================================
// 数据库连接池
// 遵循: conn-pooling
// =====================================================
const pool = new Pool({
  host: config.dbHost,
  port: config.dbPort,
  database: config.dbName,
  user: config.dbUser,
  password: config.dbPassword,
  max: 10,  // 连接池大小
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// 连接池错误处理
pool.on('error', (err) => {
  logError(err, { context: '数据库连接池错误' });
});

// =====================================================
// 测试数据库连接
// =====================================================
export async function testConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    logDatabaseConnection();
    client.release();
    return true;
  } catch (error) {
    logError(error as Error, { context: '数据库连接失败' });
    return false;
  }
}

// =====================================================
// 插入图片
// 遵循: schema-primary-keys, schema-data-types
// =====================================================
export async function insertImage(image: ImageData): Promise<number> {
  const result = await pool.query(
    `INSERT INTO images (image_data, mime_type, file_size, width, height, source_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (source_url) DO UPDATE SET
       image_data = EXCLUDED.image_data,
       mime_type = EXCLUDED.mime_type,
       file_size = EXCLUDED.file_size,
       width = EXCLUDED.width,
       height = EXCLUDED.height
     RETURNING id`,
    [
      image.data,
      image.mimeType,
      image.fileSize,
      image.width || null,
      image.height || null,
      image.sourceUrl,
    ]
  );

  return result.rows[0].id;
}

// =====================================================
// 插入产品
// 遵循: schema-primary-keys, schema-data-types, advanced-jsonb-indexing
// =====================================================
export async function insertProduct(product: Product, imageId?: number): Promise<number> {
  const result = await pool.query(
    `INSERT INTO products (name, brand, category, model, params, price, rating, images, image_id, source_url, source_platform, last_crawled_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
     ON CONFLICT (source_url) DO UPDATE SET
       name = EXCLUDED.name,
       category = EXCLUDED.category,
       params = EXCLUDED.params,
       price = EXCLUDED.price,
       rating = EXCLUDED.rating,
       images = EXCLUDED.images,
       image_id = COALESCE(EXCLUDED.image_id, products.image_id),
       last_crawled_at = NOW(),
       crawl_count = products.crawl_count + 1,
       updated_at = NOW()
     RETURNING id`,
    [
      product.name,
      product.brand,
      product.category || null,
      product.model || null,
      JSON.stringify(product.params),
      product.price || null,
      product.rating || null,
      product.images || null,
      imageId || null,
      product.sourceUrl,
      product.sourcePlatform || 'pconline',
    ]
  );

  return result.rows[0].id;
}

// =====================================================
// 批量插入产品
// 遵循: data-batch-inserts
// =====================================================
export async function batchInsertProducts(
  products: Array<Product & { imageId?: number }>
): Promise<number[]> {
  const client = await pool.connect();
  const ids: number[] = [];

  try {
    await client.query('BEGIN');

    for (const product of products) {
      const result = await client.query(
        `INSERT INTO products (name, brand, model, params, price, rating, images, image_id, source_url, source_platform, last_crawled_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
         ON CONFLICT (source_url) DO UPDATE SET
           name = EXCLUDED.name,
           params = EXCLUDED.params,
           price = EXCLUDED.price,
           rating = EXCLUDED.rating,
           images = EXCLUDED.images,
           image_id = COALESCE(EXCLUDED.image_id, products.image_id),
           last_crawled_at = NOW(),
           crawl_count = products.crawl_count + 1,
           updated_at = NOW()
         RETURNING id`,
        [
          product.name,
          product.brand,
          product.model || null,
          JSON.stringify(product.params),
          product.price || null,
          product.rating || null,
          product.images || null,
          product.imageId || null,
          product.sourceUrl,
          product.sourcePlatform || 'pconline',
        ]
      );
      ids.push(result.rows[0].id);
    }

    await client.query('COMMIT');
    logDatabaseWrite('products', ids.length);
    return ids;
  } catch (error) {
    await client.query('ROLLBACK');
    logDatabaseWriteFailed('products', error as Error);
    throw error;
  } finally {
    client.release();
  }
}

// =====================================================
// 批量插入图片
// =====================================================
export async function batchInsertImages(
  images: ImageData[]
): Promise<number[]> {
  const client = await pool.connect();
  const ids: number[] = [];

  try {
    await client.query('BEGIN');

    for (const image of images) {
      const result = await client.query(
        `INSERT INTO images (image_data, mime_type, file_size, width, height, source_url)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (source_url) DO UPDATE SET
           image_data = EXCLUDED.image_data,
           mime_type = EXCLUDED.mime_type,
           file_size = EXCLUDED.file_size,
           width = EXCLUDED.width,
           height = EXCLUDED.height
         RETURNING id`,
        [
          image.data,
          image.mimeType,
          image.fileSize,
          image.width || null,
          image.height || null,
          image.sourceUrl,
        ]
      );
      ids.push(result.rows[0].id);
    }

    await client.query('COMMIT');
    logDatabaseWrite('images', ids.length);
    return ids;
  } catch (error) {
    await client.query('ROLLBACK');
    logDatabaseWriteFailed('images', error as Error);
    throw error;
  } finally {
    client.release();
  }
}

// =====================================================
// 查询产品（按来源 URL）
// =====================================================
export async function getProductByUrl(sourceUrl: string): Promise<any | null> {
  const result = await pool.query(
    'SELECT * FROM products WHERE source_url = $1',
    [sourceUrl]
  );
  return result.rows[0] || null;
}

// =====================================================
// 查询产品（按品牌）
// =====================================================
export async function getProductsByBrand(brand: string): Promise<any[]> {
  const result = await pool.query(
    'SELECT * FROM products WHERE brand = $1 ORDER BY created_at DESC',
    [brand]
  );
  return result.rows;
}

// =====================================================
// 查询图片（按来源 URL）
// =====================================================
export async function getImageByUrl(sourceUrl: string): Promise<any | null> {
  const result = await pool.query(
    'SELECT * FROM images WHERE source_url = $1',
    [sourceUrl]
  );
  return result.rows[0] || null;
}

// =====================================================
// 统计产品数量
// =====================================================
export async function countProducts(): Promise<number> {
  const result = await pool.query('SELECT COUNT(*) as count FROM products');
  return parseInt(result.rows[0].count);
}

// =====================================================
// 统计品牌产品数量
// =====================================================
export async function countProductsByBrand(): Promise<Array<{ brand: string; count: number }>> {
  const result = await pool.query(
    `SELECT brand, COUNT(*) as count
     FROM products
     GROUP BY brand
     ORDER BY count DESC`
  );
  return result.rows;
}

// =====================================================
// 关闭连接池
// =====================================================
export async function closePool(): Promise<void> {
  await pool.end();
}
