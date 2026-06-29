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

// 检测图片格式
function detectMimeType(buffer: Buffer): string {
  if (buffer.length < 4) return 'image/jpeg';

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'image/png';
  }

  // GIF: 47 49 46 38
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return 'image/gif';
  }

  // WebP: 52 49 46 46 ... 57 45 42 50
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer.length > 11 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    return 'image/webp';
  }

  // BMP: 42 4D
  if (buffer[0] === 0x42 && buffer[1] === 0x4D) {
    return 'image/bmp';
  }

  // 默认 JPEG
  return 'image/jpeg';
}

async function main() {
  console.log('🔍 查找 MIME 类型有问题的图片...\n');

  // 查找非标准格式的图片
  const result = await pool.query(`
    SELECT id, mime_type, image_data
    FROM images
    WHERE mime_type NOT LIKE 'image/%'
  `);

  console.log(`找到 ${result.rows.length} 个需要修复的图片\n`);

  let fixed = 0;
  let failed = 0;

  for (const img of result.rows) {
    const detectedType = detectMimeType(img.image_data);

    if (detectedType !== 'image/jpeg' || img.mime_type !== 'image/jpeg') {
      console.log(`  ID: ${img.id}, ${img.mime_type} → ${detectedType}`);
    }

    await pool.query(
      'UPDATE images SET mime_type = $1 WHERE id = $2',
      [detectedType, img.id]
    );
    fixed++;
  }

  console.log(`\n✅ 修复完成: ${fixed} 个`);

  // 验证结果
  const stats = await pool.query(`
    SELECT mime_type, COUNT(*) as count
    FROM images
    GROUP BY mime_type
    ORDER BY count DESC
  `);

  console.log('\n📊 修复后的格式分布:');
  for (const row of stats.rows) {
    console.log(`  ${row.mime_type}: ${row.count}`);
  }

  await pool.end();
}
main();
