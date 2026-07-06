import { Hono } from 'hono';
import { db } from '../../db/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrate = new Hono();

// 临时迁移接口，执行后删除
migrate.post('/api/admin/migrate-v2', async (c) => {
  try {
    const sqlPath = path.join(__dirname, '../../db/admin-schema-v2.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    await db.query(sql);
    return c.json({ success: true, message: 'v2 迁移完成' });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

export default migrate;
