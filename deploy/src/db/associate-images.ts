/** 无图产品: 尝试 _m 图, 若已在 images 表中则直接关联 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const p = new pg.Pool({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
const PROD_DIR = 'C:\\Users\\20264\\Desktop\\My\\crawler\\da\\products';

const { rows } = await p.query(`SELECT id, name, source_url FROM products WHERE category='air_condition' AND image_id IS NULL`);
console.log(`无图产品: ${rows.length} 条`);

let ok = 0;
for (const row of rows) {
  const pid = row.source_url?.match(/(\d+)\.html/)?.[1];
  if (!pid) continue;
  let mainImage = '';
  const brandDirs = fs.readdirSync(PROD_DIR);
  for (const brand of brandDirs) {
    const fp = path.join(PROD_DIR, brand, `${pid}.json`);
    if (fs.existsSync(fp)) {
      try { mainImage = JSON.parse(fs.readFileSync(fp,'utf-8')).main_image || ''; } catch {}
      break;
    }
  }
  if (!mainImage) continue;

  // 尝试 _m 版本
  const mUrl = mainImage.replace(/\.(jpg|jpeg|png)$/i, '_m.$1');
  // 查 images 表是否有此 URL
  const r = await p.query('SELECT id FROM images WHERE source_url = $1', [mUrl]);
  if (r.rows.length > 0) {
    await p.query('UPDATE products SET image_id = $1 WHERE id = $2 AND image_id IS NULL', [r.rows[0].id, row.id]);
    ok++;
    console.log(`  ✓ ${row.id} -> image_id=${r.rows[0].id}`);
  }
}
console.log(`\n关联成功: ${ok} 条`);
await p.end();
