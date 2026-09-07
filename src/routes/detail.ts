import { Hono } from 'hono'
import { getProductById, getProductParams, getProductImages, getProductIntroImages } from '../db/index.js'

const detail = new Hono()

function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url) return false
  if (url.startsWith('data:')) return true
  if (url.startsWith('http')) return true
  if (url.startsWith('/local-images/')) return true
  return false
}

function filterUrls(urls: string[]): string[] {
  return urls.filter(isValidImageUrl)
}

detail.get('/api/detail', async (c) => {
  const id = parseInt(c.req.query('id') || '1')
  console.log('详情ID:', id)

  try {
    const product = await getProductById(id)

    if (!product) {
      return c.json({
        code: -1,
        message: '产品不存在'
      }, 404)
    }

    const params = await getProductParams(id)

    const [mainImages, introImages] = await Promise.all([
      getProductImages(product.id).then(filterUrls),
      getProductIntroImages(product.id).then(filterUrls),
    ])

    return c.json({
      code: 0,
      data: {
        id: product.id,
        name: product.name,
        brand: product.brand,
        model: product.model,
        price: product.price,
        rating: product.rating,
        main_image: mainImages.length > 0 ? mainImages[0] : '',
        images: mainImages,
        intro_images: introImages,
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
