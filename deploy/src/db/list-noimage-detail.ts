/** 列出无图产品: 产品名 + 详情页 + 图片URL(已失效) + 品牌+型号 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const p = new pg.Pool({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
const PROD_DIR = 'C:\\Users\\20264\\Desktop\\My\\crawler\\da\\products';

const r = await p.query(
  `SELECT id, name, brand, source_url FROM products
   WHERE category='air_condition' AND image_id IS NULL
   ORDER BY brand, name`
);

console.log(`无图产品: ${r.rows.length} 条\n`);

for (const row of r.rows) {
  const match = row.source_url?.match(/(\d+)\.html/);
  const pid = match ? match[1] : '?';

  // 从 products/ 读 main_image URL
  let imgUrl = '';
  const brandDir = path.join(PROD_DIR, row.brand || '');
  const fp = path.join(brandDir, `${pid}.json`);
  if (fs.existsSync(fp)) {
    try {
      const d = JSON.parse(fs.readFileSync(fp, 'utf-8'));
      imgUrl = d.main_image || '';
    } catch {}
  }

  console.log(`---`);
  console.log(`品牌: ${row.brand}`);
  console.log(`产品: ${row.name}`);
  console.log(`详情: ${row.source_url}`);
  console.log(`图片: ${imgUrl || '(无)'}`);
}
await p.end();
