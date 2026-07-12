import { Hono } from 'hono'
import { pool } from '../db/index.js'

const image = new Hono()

/**
 * 从 URL 下载图片并存储到数据库
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

    console.log('📥 下载图片:', url)

    // 1. 检查是否已存在（按 source_url 去重）
    const existing = await pool.query(
      'SELECT id FROM images WHERE source_url = $1',
      [url]
    )

    if (existing.rows.length > 0) {
      console.log('✅ 图片已存在，ID:', existing.rows[0].id)
      return c.json({
        code: 0,
        message: '图片已存在',
        data: { id: existing.rows[0].id }
      })
    }

    // 2. 下载图片
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://product.pconline.com.cn/'
      }
    })

    if (!response.ok) {
      return c.json({ error: `下载失败: ${response.status}` }, 400)
    }

    // 3. 获取图片数据
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 4. 检测 MIME 类型
    const contentType = response.headers.get('Content-Type') || 'image/jpeg'
    let mimeType = contentType.split(';')[0].trim()

    // 处理非标准 MIME 类型
    if (mimeType === 'application/octet-stream' || !mimeType.startsWith('image/')) {
      const urlLower = url.toLowerCase()
      if (urlLower.endsWith('.png')) mimeType = 'image/png'
      else if (urlLower.endsWith('.gif')) mimeType = 'image/gif'
      else if (urlLower.endsWith('.webp')) mimeType = 'image/webp'
      else mimeType = 'image/jpeg'
    }

    // 5. 存入数据库
    const result = await pool.query(`
      INSERT INTO images (image_data, mime_type, file_size, source_url, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id
    `, [buffer, mimeType, buffer.length, url])

    const imageId = result.rows[0].id
    console.log('✅ 图片已保存，ID:', imageId, '大小:', buffer.length, '类型:', mimeType)

    // 6. 如果提供了 product_id，关联到产品
    if (product_id) {
      await pool.query(
        'UPDATE products SET image_id = $1 WHERE id = $2',
        [imageId, product_id]
      )
      console.log('✅ 已关联到产品:', product_id)
    }

    return c.json({
      code: 0,
      message: '图片下载成功',
      data: {
        id: imageId,
        mime_type: mimeType,
        file_size: buffer.length
      }
    })

  } catch (error) {
    console.error('❌ 图片下载失败:', error)
    return c.json({
      code: -1,
      error: '图片下载失败',
      message: (error as Error).message
    }, 500)
  }
})

/**
 * 上传图片文件
 * POST /api/image/upload
 * Content-Type: multipart/form-data
 */
image.post('/api/image/upload', async (c) => {
  try {
    const formData = await c.req.formData()
    const file = formData.get('file') as File
    const productId = formData.get('product_id') as string

    if (!file) {
      return c.json({ error: '缺少文件' }, 400)
    }

    console.log('📤 上传图片:', file.name, '大小:', file.size)

    // 1. 读取文件数据
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 2. 检测 MIME 类型
    let mimeType = file.type || 'image/jpeg'
    if (!mimeType.startsWith('image/')) {
      mimeType = 'image/jpeg'
    }

    // 3. 存入数据库
    const result = await pool.query(`
      INSERT INTO images (image_data, mime_type, file_size, created_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING id
    `, [buffer, mimeType, buffer.length])

    const imageId = result.rows[0].id
    console.log('✅ 图片已保存，ID:', imageId)

    // 4. 如果提供了 product_id，关联到产品
    if (productId) {
      await pool.query(
        'UPDATE products SET image_id = $1 WHERE id = $2',
        [imageId, parseInt(productId)]
      )
    }

    return c.json({
      code: 0,
      message: '图片上传成功',
      data: {
        id: imageId,
        mime_type: mimeType,
        file_size: buffer.length
      }
    })

  } catch (error) {
    console.error('❌ 图片上传失败:', error)
    return c.json({
      code: -1,
      error: '图片上传失败',
      message: (error as Error).message
    }, 500)
  }
})

/**
 * 读取图片
 * GET /api/image/:id
 */
image.get('/api/image/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))

    if (isNaN(id)) {
      return c.json({ error: '无效的图片 ID' }, 400)
    }

    // 从数据库读取图片
    const result = await pool.query(
      'SELECT image_data, mime_type FROM images WHERE id = $1',
      [id]
    )

    if (result.rows.length === 0) {
      return c.json({ error: '图片不存在' }, 404)
    }

    const { image_data, mime_type } = result.rows[0]

    // 返回图片（使用 c.body 返回二进制数据）
    return c.body(image_data, 200, {
      'Content-Type': mime_type,
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*'
    })

  } catch (error) {
    console.error('❌ 读取图片失败:', error)
    return c.json({ error: '读取图片失败' }, 500)
  }
})

/**
 * 获取产品的图片列表
 * GET /api/image/product/:productId
 */
image.get('/api/image/product/:productId', async (c) => {
  try {
    const productId = parseInt(c.req.param('productId'))

    // 获取产品关联的图片
    const result = await pool.query(`
      SELECT i.id, i.mime_type, i.file_size, i.created_at
      FROM images i
      INNER JOIN products p ON p.image_id = i.id
      WHERE p.id = $1
    `, [productId])

    const images = result.rows.map(row => ({
      id: row.id,
      url: `/api/image/${row.id}`,
      mime_type: row.mime_type,
      file_size: row.file_size,
      created_at: row.created_at
    }))

    return c.json({
      code: 0,
      data: images
    })

  } catch (error) {
    console.error('❌ 获取产品图片失败:', error)
    return c.json({ error: '获取产品图片失败' }, 500)
  }
})

/**
 * 删除图片
 * DELETE /api/image/:id
 */
image.delete('/api/image/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))

    // 先取消产品关联
    await pool.query(
      'UPDATE products SET image_id = NULL WHERE image_id = $1',
      [id]
    )

    // 删除图片
    const result = await pool.query(
      'DELETE FROM images WHERE id = $1 RETURNING id',
      [id]
    )

    if (result.rows.length === 0) {
      return c.json({ error: '图片不存在' }, 404)
    }

    return c.json({
      code: 0,
      message: '图片已删除'
    })

  } catch (error) {
    console.error('❌ 删除图片失败:', error)
    return c.json({ error: '删除图片失败' }, 500)
  }
})

export default image
