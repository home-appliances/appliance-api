import { Hono } from 'hono';
import { pool } from '../../db/index.js';
import { authMiddleware } from '../../middleware/auth.js';

const settings = new Hono();

settings.use('/api/admin/settings', authMiddleware);

/**
 * 获取所有设置
 * GET /api/admin/settings
 */
settings.get('/api/admin/settings', async (c) => {
  try {
    const result = await pool.query('SELECT key, value FROM system_settings');
    const data: Record<string, any> = {};
    result.rows.forEach(row => { data[row.key] = row.value; });

    return c.json({ code: 0, data });
  } catch (error) {
    console.error('获取设置失败:', error);
    return c.json({ code: 500, message: '获取设置失败' }, 500);
  }
});

/**
 * 更新设置
 * PUT /api/admin/settings
 */
settings.put('/api/admin/settings', async (c) => {
  try {
    const { key, value } = await c.req.json();

    if (!key || value === undefined) {
      return c.json({ code: 400, message: '缺少 key 或 value' }, 400);
    }

    await pool.query(
      `INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, JSON.stringify(value)]
    );

    return c.json({ code: 0, message: '设置更新成功' });
  } catch (error) {
    console.error('更新设置失败:', error);
    return c.json({ code: 500, message: '更新设置失败' }, 500);
  }
});

export default settings;
