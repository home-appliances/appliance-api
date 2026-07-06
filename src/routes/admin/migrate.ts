import { Hono } from 'hono';
import { pool } from '../../db/index.js';
import fs from 'fs';
import path from 'path';

const migrate = new Hono();

// 临时迁移接口，执行后删除
migrate.post('/migrate-v2', async (c) => {
  try {
    const sqlPath = path.join(process.cwd(), 'db', 'admin-schema-v2.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    await pool.query(sql);
    return c.json({ success: true, message: 'v2 迁移完成' });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

export default migrate;
