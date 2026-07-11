/** 导出59条无图产品到 da/noimage_products.json */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const p = new pg.Pool({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
const PROD_DIR = 'C:\\Users\\20264\\Desktop\\My\\crawler\\da\\products';

(async()=>{
const r = await p.query(`SELECT id, name, brand, source_url FROM products WHERE category='air_condition' AND image_id IS NULL ORDER BY brand, name`);
const items = [];
for (const row of r.rows) {
  const pid = row.source_url?.match(/(\d+)\.html/)?.[1] || '?';
  let imgUrl = '';
  const fp = path.join(PROD_DIR, row.brand || '', `${pid}.json`);
  if (fs.existsSync(fp)) {
    try { imgUrl = JSON.parse(fs.readFileSync(fp,'utf-8')).main_image || ''; } catch {}
  }
  items.push({
    brand: row.brand,
    product_name: row.name,
    detail_url: row.source_url,
    main_image_url: imgUrl,
    status: imgUrl ? '太平洋图床已删除,图片不可用' : '原始数据无图片URL',
  });
}
const out = { total: items.length, note: '以下产品无有效图片(太平洋图床已删除原始图片)', items };
const outPath = path.resolve(PROD_DIR, '..', 'noimage_products.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf-8');
console.log(`已导出 ${items.length} 条到 noimage_products.json`);
await p.end();
})();
