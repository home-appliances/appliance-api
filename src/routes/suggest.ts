import { Hono } from 'hono'
import { getSuggestions } from '../db/index.js'

const suggest = new Hono()

suggest.get('/api/suggest', async (c) => {
  const keyword = c.req.query('keyword') || ''
  const limit = parseInt(c.req.query('limit') || '8')

  try {
    const suggestions = await getSuggestions(keyword, limit)
    return c.json({ code: 0, data: suggestions })
  } catch (error) {
    console.error('获取搜索建议失败:', error)
    return c.json({ code: -1, data: [] })
  }
})

export default suggest
