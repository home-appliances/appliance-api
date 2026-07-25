import { Hono } from 'hono'
import { getHotSearches } from '../db/index.js'

const hot = new Hono()

hot.get('/api/hot', async (c) => {
  const limit = parseInt(c.req.query('limit') || '10', 10)

  try {
    const keywords = await getHotSearches(Number.isFinite(limit) ? limit : 10)
    return c.json({ code: 0, data: keywords })
  } catch (error) {
    console.error('获取热门搜索失败:', error)
    return c.json({ code: -1, data: [], message: '获取热门搜索失败' })
  }
})

export default hot
