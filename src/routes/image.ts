/**
 * 图片相关 API
 * 兼容：
 * - POST /api/image/download|upload -> 下载/上传到 OSS，写入 product_images 表
 */
import { Hono } from 'hono'
import { pool } from '../db/index.js'
import {ensureRemoteImageOnOss,uploadBufferViaStaging} from '../utils/image-oss-pipeline.js'

const image = new Hono()

// 写入主图到 product_images（先删旧主图再插新主图）
async function setMainImage(productId: number, imageUrl: string) {
  await pool.query('DELETE FROM product_images WHERE product_id = $1 AND image_type = $2', [productId, 'main'])
  await pool.query(
    `INSERT INTO product_images (product_id, image_url, image_type, sort_order, created_at)
     VALUES ($1, $2, 'main', 0, NOW())`,
    [productId, imageUrl]
  )
  await pool.query('UPDATE products SET updated_at = NOW() WHERE id = $1', [productId])
}

/**
 * 从 URL 下载并上传 OSS
 * POST /api/image/download
 * Body: { url: string, product_id?: number }
 */
image.post('/api/image/download', async (c) => {
  try {
    const body = await c.req.json()
    const { url, product_id } = body

    if (!url) {
      return c.json({ error: '缺少 url 参数' }, 400)
    }

    const ossUrl = await ensureRemoteImageOnOss(url)

    if (product_id) {
      await setMainImage(product_id, ossUrl)
    }

    return c.json({
      code: 0,
      message: '已上传 OSS',
      data: { url: ossUrl },
    })
  } catch (error: any) {
    console.error('下载/上传失败:', error)
    return c.json({ error: error.message || '处理失败' }, 500)
  }
})

/**
 * 上传本地文件到 OSS
 * POST /api/image/upload
 */
image.post('/api/image/upload', async (c) => {
  try {
    const body = await c.req.parseBody()
    const file = body['file'] as File
    const productId = body['product_id'] ? parseInt(String(body['product_id']), 10) : null

    if (!file) {
      return c.json({ error: '缺少 file' }, 400)
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const ossUrl = await uploadBufferViaStaging(buffer, {
      originalName: file.name || 'upload.jpg',
      mimeType: file.type || 'image/jpeg',
    })

    if (productId) {
      await setMainImage(productId, ossUrl)
    }

    return c.json({ code: 0, message: '已上传 OSS', data: { url: ossUrl } })
  } catch (error: any) {
    console.error('上传失败:', error)
    return c.json({ error: error.message || '上传失败' }, 500)
  }
})

/**
 * GET /api/image/:id
 */
image.get('/api/image/:id', async (c) => {
  const id = c.req.param('id')
  const { LOCAL_IMAGE_DIR } = await import('../utils/image-local.js')
  const pathMod = await import('path')
  const fsMod = await import('fs')
  for (const ext of ['.jpg', '.jpeg', '.png', '.gif', '.webp']) {
    const filePath = pathMod.join(LOCAL_IMAGE_DIR, `${id}${ext}`)
    if (fsMod.existsSync(filePath)) {
      return c.redirect(`/local-images/${id}${ext}`, 302)
    }
  }
  return c.json(
    {
      code: 410,
      message: '图片已迁出数据库。本地请用 /local-images/{id}.jpg；线上请用 OSS CDN URL',
    },
    410
  )
})

/**
 * 产品图片列表
 * GET /api/image/product/:productId
 */
image.get('/api/image/product/:productId', async (c) => {
  try {
    const productId = parseInt(c.req.param('productId'), 10)
    const r = await pool.query(
      `SELECT id, image_url AS url, image_type, sort_order
       FROM product_images WHERE product_id = $1
       ORDER BY image_type ASC, sort_order ASC, id ASC`,
      [productId]
    )
    return c.json({
      code: 0,
      data: r.rows.map((row: any) => ({
        id: row.id,
        url: row.url,
        image_type: row.image_type,
      })),
    })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

/**
 * DELETE /api/image/:id
 */
image.delete('/api/image/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  await pool.query('DELETE FROM product_images WHERE id = $1', [id])
  return c.json({ code: 0, message: '已删除该图片记录' })
})

export default image
