import { Hono } from 'hono'
import { searchProducts, logSearch } from '../db/index.js'

const search = new Hono()

search.get('/api/search', async (c) => {
  const keyword = c.req.query('keyword') || ''
  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '20')

  console.log('搜索关键词:', keyword)

  // 记录搜索关键词（异步，不阻塞响应）
  if (keyword && keyword.trim()) {
    logSearch(keyword).catch(err => console.error('记录搜索失败:', err));
  }

  try {
    const result = await searchProducts(keyword, page, limit)

    // 根据产品类别选择显示标签
    const getTagFields = (params: Record<string, string>, category: string): string[] => {
      const tagFields: Record<string, string[]> = {
        icebox: ['总容积', '制冷方式', '能效等级'],
        air_condition: ['匹数', '能效等级', '冷暖类型'],
        washer: ['洗涤容量', '能效等级', '变频/定频'],
        gas_water: ['升数', '能效等级', '恒温功能'],
        central_water: ['升数', '能效等级'],
        heater: ['功率', '适用面积'],
        lcd_tv: ['屏幕尺寸', '分辨率', '能效等级'],
        rice_cooker: ['容积', '能效等级', '内胆材质'],
      }
      return tagFields[category] || ['能效等级']
    }

    // 转换为前端需要的格式
    const products = result.products.map((p) => {
      const tagFields = getTagFields(p.params || {}, p.category || '')
      const tagValues = tagFields.map(field => p.params?.[field] || '').filter(Boolean)

      return {
        id: p.id,
        title: p.title || p.name,
        img: p.img || '',
        tag: [p.brand, ...tagValues].filter(Boolean),
        brand: p.brand,
        model: p.model,
        price: p.price,
        category: p.category,
        _score: p.rank || 0,
      }
    })

    return c.json({
      code: 0,
      data: products,
      keyword: keyword,           // 返回搜索关键词，便于前端处理
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      }
    })
  } catch (error) {
    console.error('搜索失败:', error)
    return c.json({
      code: -1,
      message: '搜索失败',
      error: (error as Error).message
    }, 500)
  }
})

export default search
