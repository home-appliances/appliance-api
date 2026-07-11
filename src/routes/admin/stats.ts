import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth.js';
import * as queries from '../../db/queries.js';

const stats = new Hono();

// 所有统计路由都需要认证
stats.use('/api/admin/stats/*', authMiddleware);

/**
 * 数据概览
 * GET /api/admin/stats/overview
 */
stats.get('/api/admin/stats/overview', async (c) => {
  try {
    const dashboardStats = await queries.getDashboardStats();

    return c.json({
      code: 0,
      data: dashboardStats,
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    return c.json({ code: 500, message: '获取统计数据失败' }, 500);
  }
});

/**
 * 获取品牌统计
 * GET /api/admin/stats/brands
 */
stats.get('/api/admin/stats/brands', async (c) => {
  try {
    const brands = await queries.getBrands();

    return c.json({
      code: 0,
      data: brands,
    });
  } catch (error) {
    console.error('获取品牌统计失败:', error);
    return c.json({ code: 500, message: '获取品牌统计失败' }, 500);
  }
});

export default stats;
