/** 从 products/ 文件查无图产品的来源,尝试用另一源图片补 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
const PROD_DIR = 'C:\\Users\\20264\\Desktop\\My\\crawler\\da\\products';

async function download(url, ms=10000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
    clearTimeout(t); if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch { clearTimeout(t); return null; }
}

const { rows } = await pool.query(
  `SELECT id, name, brand, source_url FROM products WHERE category='air_condition' AND image_id IS NULL`
);
console.log(`无图产品: ${rows.length} 条\n`);

const ZOL_DIR = path.resolve(PROD_DIR, '..\\..\\zol_data\\air_condition');
const PC_DIR = path.resolve(PROD_DIR, '..\\..\\pconline_data\\air_condition');

let ok = 0, found = 0, none = 0;
for (const row of rows) {
  // 从源URL提取ID,尝试在zol/pc原始目录找对应文件
  const match = row.source_url?.match(/(\d+)\.html/);
  if (!match) { none++; continue; }
  const pid = match[1];

  // 在ZOL原始数据找(按ID)
  let altUrl = null;
  for (const base of [ZOL_DIR, PC_DIR]) {
    if (!fs.existsSync(base)) continue;
    for (const brand of fs.readdirSync(base)) {
      const fp = path.join(base, brand, `${pid}.json`);
      if (fs.existsSync(fp)) {
        try {
          const d = JSON.parse(fs.readFileSync(fp, 'utf-8'));
          const img = d.main_image_url || d.main_image;
          if (img) altUrl = img;
        } catch {}
        break;
      }
    }
    if (altUrl) break;
  }

  if (!altUrl) {
    // 再看 products/ 的 source_files 字段
    const brandDir = path.join(PROD_DIR, row.brand || '');
    const fp = path.join(brandDir, `${pid}.json`);
    if (fs.existsSync(fp)) {
      try {
        const d = JSON.parse(fs.readFileSync(fp, 'utf-8'));
        // 已有的 main_image 是失效的太平洋图
        // 看该产品是否有另一个源的图片
        const srcFiles = d.source_files || [];
        for (const sf of srcFiles) {
          if (!sf) continue;
          const sfp = path.resolve(PROD_DIR, '..', '..', sf);
          if (fs.existsSync(sfp)) {
            const sd = JSON.parse(fs.readFileSync(sfp, 'utf-8'));
            altUrl = sd.main_image_url || sd.main_image || null;
            if (altUrl && altUrl !== d.main_image) break; // 不同源的图
          }
        }
      } catch {}
    }
  }

  if (altUrl) {
    found++;
    const buf = await download(altUrl);
    if (buf) {
      const r = await pool.query(
        `INSERT INTO images (image_data, mime_type, file_size, source_url, created_at)
         VALUES ($1, 'image/jpeg', $2, $3, NOW()) RETURNING id`,
        [buf, buf.length, altUrl]
      );
      await pool.query('UPDATE products SET image_id = $1 WHERE id = $2', [r.rows[0].id, row.id]);
      ok++;
      console.log(`✅ ${(row.name||'').slice(0,24)} 补图成功 (${buf.length}B)`);
    } else {
      console.log(`❌ ${(row.name||'').slice(0,24)} 替代图也失效: ${altUrl.slice(0,60)}`);
    }
  } else {
    none++;
    console.log(`⚠ ${(row.name||'').slice(0,24)} 无替代图片源`);
  }
}
console.log(`\n完成: 补成功 ${ok}, 找到替代源但失效 ${found-ok}, 无替代源 ${none}`);
await pool.end();
