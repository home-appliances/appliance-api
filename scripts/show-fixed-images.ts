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

async function main() {
  const result = await pool.query(`
    SELECT p.id, p.name, p.brand, p.model,
           i.id as image_id, i.mime_type,
           octet_length(i.image_data) as image_bytes
    FROM products p
    JOIN images i ON p.image_id = i.id
    WHERE p.id IN (
      74689, 74902, 74903, 74904, 74905, 74906, 74907, 74908, 74909, 74910,
      74911, 74912, 74913, 74914, 74915, 74916, 74917, 74918, 74919, 74920,
      74921, 74922, 76493, 76510, 77168, 77169, 77170, 77171, 77172, 77173,
      77174, 77175, 77281, 77282, 78957, 79648, 79649, 79654, 80217, 80629,
      80752, 80753, 80754, 80827, 80838, 81960
    )
    ORDER BY p.id
  `);

  console.log('修复的 46 张图片详情:\n');
  console.log('# | ID | 品牌 | 型号 | 图片ID | MIME格式 | 大小');
  console.log('--|--|------|------|--------|----------|------');

  let num = 1;
  for (const p of result.rows) {
    const sizeKB = (p.image_bytes / 1024).toFixed(1);
    console.log(`${num} | ${p.id} | ${p.brand} | ${p.model} | ${p.image_id} | ${p.mime_type} | ${sizeKB} KB`);
    num++;
  }

  // 统计格式分布
  const formatStats: Record<string, number> = {};
  for (const p of result.rows) {
    formatStats[p.mime_type] = (formatStats[p.mime_type] || 0) + 1;
  }

  console.log('\n📊 格式分布:');
  for (const [format, count] of Object.entries(formatStats)) {
    console.log(`  - ${format}: ${count} 张`);
  }

  await pool.end();
}
main();
