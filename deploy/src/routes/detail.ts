import { Hono } from 'hono'
import { getProductById, getProductParams, getProductImages, pool } from '../db/index.js'

const detail = new Hono()

// 获取产品图片（返回 base64）
async function getProductImageUrls(product: any): Promise<string[]> {
  const images: string[] = [];

  // 1. 优先使用 image_id 从 images 表获取
  if (product.image_id) {
    try {
      const result = await pool.query(
        'SELECT image_data, mime_type FROM images WHERE id = $1',
        [product.image_id]
      );
      if (result.rows.length > 0 && result.rows[0].image_data) {
        const { image_data, mime_type } = result.rows[0];
        // 过滤过小的图片数据（已损坏/截断的图片可能只有几字节）
        if (image_data.length > 1024) {
          images.push(`data:${mime_type};base64,${image_data.toString('base64')}`);
        } else {
          console.warn('图片数据过小，跳过:', product.image_id, image_data.length);
        }
      }
    } catch (e) {
      console.error('获取图片失败:', e);
    }
  }

  // 2. 降级：使用旧的 getProductImages 函数（兼容旧数据）
  if (images.length === 0) {
    const oldImages = await getProductImages(product.id);
    images.push(...oldImages);
  }

  // 3. 过滤无效图片
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
