import { Hono } from 'hono'
import { cors } from 'hono/cors'

const imageProxy = new Hono()

// 图片代理接口 - 解决 Content-Type 问题
imageProxy.get('/api/image-proxy', async (c) => {
  const url = c.req.query('url')

  if (!url) {
    return c.json({ error: '缺少 url 参数' }, 400)
  }

  // 验证 URL 是否来自太平洋电脑网
  const allowedDomains = [
    'img.pconline.com.cn',
    'img4.pconline.com.cn',
    'img2.pconline.com.cn',
    'img3.pconline.com.cn'
  ]

  try {
    const urlObj = new URL(url)
    if (!allowedDomains.includes(urlObj.hostname)) {
      return c.json({ error: '不允许的图片域名' }, 403)
    }
  } catch (e) {
    return c.json({ error: '无效的 URL' }, 400)
  }

  try {
    // 请求原始图片
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Referer': 'https://product.pconline.com.cn/',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
      }
    })

    if (!response.ok) {
      return c.json({ error: '图片请求失败' }, response.status as any)
    }

    // 获取图片数据
    const imageBuffer = await response.arrayBuffer()

    // 检测图片类型
    const contentType = response.headers.get('Content-Type') || 'image/jpeg'
    let imageType = 'image/jpeg'

    // 如果是 application/octet-stream，根据文件扩展名或内容检测
    if (contentType === 'application/octet-stream' || contentType === 'application/xml') {
      const urlLower = url.toLowerCase()
      if (urlLower.endsWith('.png')) {
        imageType = 'image/png'
      } else if (urlLower.endsWith('.gif')) {
        imageType = 'image/gif'
      } else if (urlLower.endsWith('.webp')) {
        imageType = 'image/webp'
      } else {
        // 默认为 JPEG
        imageType = 'image/jpeg'
      }
    } else {
      imageType = contentType
    }

    // 返回图片，设置正确的 Content-Type
    return new Response(imageBuffer, {
      headers: {
        'Content-Type': imageType,
        'Cache-Control': 'public, max-age=86400', // 缓存 24 小时
        'Access-Control-Allow-Origin': '*'
      }
    })

  } catch (error) {
    console.error('图片代理错误:', error)
    return c.json({ error: '图片代理失败' }, 500)
  }
})

export default imageProxy
