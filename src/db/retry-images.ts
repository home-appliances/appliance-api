/** 查出无图产品, 从 products/ 文件读图片 URL 并补下载 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });

const PROD_DIR = 'C:\\Users\\20264\\Desktop\\My\\crawler\\da\\products';

async function download(url: string): Promise<Buffer | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
    clearTimeout(t);
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch { clearTimeout(t); return null; }
}

// 查无图产品
const { rows } = await pool.query(
  `SELECT id, source_url FROM products WHERE category='air_condition' AND image_id IS NULL`
);
console.log(`无图产品: ${rows.length} 条`);

let ok = 0, fail = 0;
for (const row of rows) {
  // 从 source_url 提取 product_id(数字)
  const pidMatch = row.source_url?.match(/(\d+)\.html/);
  if (!pidMatch) { fail++; continue; }
  const pid = pidMatch[1];

  // 在 products/ 下找此 pid 的文件
  let mainImage: string | null = null;
  const brandDirs = fs.readdirSync(PROD_DIR);
  for (const brand of brandDirs) {
    const fp = path.join(PROD_DIR, brand, `${pid}.json`);
    if (fs.existsSync(fp)) {
      try {
        const d = JSON.parse(fs.readFileSync(fp, 'utf-8'));
        mainImage = d.main_image || null;
      } catch {}
      break;
    }
  }

  if (!mainImage) { fail++; continue; }

  // 已存在此 URL 的图片则直接关联
  const exist = await pool.query('SELECT id FROM images WHERE source_url = $1', [mainImage]);
  if (exist.rows.length > 0) {
    await pool.query('UPDATE products SET image_id = $1 WHERE id = $2', [exist.rows[0].id, row.id]);
    ok++;
    console.log(`  ✓ ${row.id} (已有图片,直接关联)`);
    continue;
  }

  // 下载
  const buf = await download(mainImage);
  if (!buf) { fail++; console.log(`  ✗ ${row.id} 下载失败 ${mainImage.slice(0,60)}`); continue; }

  const r = await pool.query(
    `INSERT INTO images (image_data, mime_type, file_size, source_url, created_at)
     VALUES ($1, 'image/jpeg', $2, $3, NOW()) RETURNING id`,
    [buf, buf.length, mainImage]
  );
  await pool.query('UPDATE products SET image_id = $1 WHERE id = $2', [r.rows[0].id, row.id]);
  ok++;
  console.log(`  ✓ ${row.id} 下载成功 (${buf.length} bytes)`);
}

console.log(`\n完成: 成功 ${ok}, 失败 ${fail}`);
await pool.end();
