import { Hono } from 'hono'
import { getProductById, getProductParams, getProductImages } from '../db/index.js'

const detail = new Hono()

// 获取产品图片 URL 列表（过滤无效值）
async function getProductImageUrls(product: any): Promise<string[]> {
  const images = await getProductImages(product.id);
  return images.filter(url => {
    if (!url) return false;
    if (url.startsWith('data:')) return true;
    if (url.startsWith('http')) return true;
    return false;
  });
}

detail.get('/api/detail', async (c) => {
  const id = parseInt(c.req.query('id') || '1')
  console.log('详情ID:', id)

  try {
    // 获取产品基本信息
    const product = await getProductById(id)

    if (!product) {
      return c.json({
        code: -1,
        message: '产品不存在'
      }, 404)
    }

    // 获取产品参数（平铺）
    const params = await getProductParams(id)

    // 获取产品图片
    const images = await getProductImageUrls(product)

    // 返回前端期望的格式
    return c.json({
      code: 0,
      data: {
        id: product.id,
        name: product.name,
        brand: product.brand,
        model: product.model,
        price: product.price,
        rating: product.rating,
        main_image: product.main_image || (images.length > 0 ? images[0] : ''),
        images: images,
        sourceUrl: product.source_url,
        params: params || {},
      }
    })
  } catch (error) {
    console.error('获取详情失败:', error)
    return c.json({
      code: -1,
      message: '获取详情失败',
      error: (error as Error).message
    }, 500)
  }
})

export default detail
