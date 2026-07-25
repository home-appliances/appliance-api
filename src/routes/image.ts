/**
 * 图片相关 API
 * 兼容：
 * - POST /api/image/download|upload → 下载/上传到 OSS，回写 products.main_image
 */
import { Hono } from 'hono'
import { pool } from '../db/index.js'
import {ensureRemoteImageOnOss,uploadBufferViaStaging} from '../utils/image-oss-pipeline.js'

const image = new Hono()

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
      await pool.query(
        'UPDATE products SET main_image = $1, image_id = NULL, updated_at = NOW() WHERE id = $2',
        [ossUrl, product_id]
      )
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
      await pool.query(
        'UPDATE products SET main_image = $1, image_id = NULL, updated_at = NOW() WHERE id = $2',
        [ossUrl, productId]
      )
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
  const { LOCAL_IMAGE_DIR, mimeFromExt } = await import('../utils/image-local.js')
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
    const p = await pool.query(`SELECT main_image FROM products WHERE id = $1`, [productId])
    if (p.rows[0]?.main_image) {
      return c.json({
        code: 0,
        data: [{ id: 0, url: p.rows[0].main_image, image_type: 'main' }],
      })
    }
    return c.json({ code: 0, data: [] })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

/**
 * DELETE /api/image/:id
 */
image.delete('/api/image/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  await pool.query('UPDATE products SET image_id = NULL WHERE image_id = $1', [id])
  try {
    await pool.query('DELETE FROM images WHERE id = $1', [id])
  } catch {
    /* ignore */
  }
  return c.json({ code: 0, message: '已清理引用（BYTEA 表若已清空可忽略）' })
})

export default image
