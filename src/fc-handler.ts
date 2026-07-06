/**
 * 阿里云函数计算 (FC 3.0) HTTP 触发器入口
 * 将 FC 的 event/context 转换为 Hono 的 Request/Response
 * 更新时间: 2026-07-02 03:30
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import fs from 'fs'
import path from 'path'
import search from './routes/search.js'
import detail from './routes/detail.js'
import suggest from './routes/suggest.js'
import recommend from './routes/recommend.js'
import adminApi from './routes/admin/index.js'
import adminSSR from './admin/routes.js'
import airConditioners from './routes/air-conditioners.js'
import imageProxy from './routes/image-proxy.js'
import category from './routes/category.js'
import image from './routes/image.js'

const app = new Hono()

// 全局 CORS 跨域
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization']
}))

// 挂载路由
app.route('/', search)
app.route('/', detail)
app.route('/', suggest)
app.route('/', recommend)
app.route('/api/admin', adminApi)  // 管理后台 API
app.route('/admin', adminSSR)      // 管理后台 SSR 页面
app.route('/api/air-conditioners', airConditioners)
app.route('/', imageProxy)
app.route('/', category)
app.route('/', image)

// 管理后台 CSS 静态文件（SSR 页面需要）
app.get('/admin/css/*', async (c) => {
  const cssFile = c.req.path.replace('/admin/css/', '')
  const filePath = path.join(process.cwd(), 'admin-panel', 'css', cssFile)
  try {
    const content = fs.readFileSync(filePath)
    return new Response(content, { headers: { 'content-type': 'text/css; charset=utf-8' } })
  } catch {
    return c.text('Not Found', 404)
  }
})

// 管理后台根路径重定向
app.get('/admin', (c) => c.redirect('/admin/'))

// 根路径测试
app.get('/', (c) => {
  return c.json({ message: '家电搜索API服务运行中', version: '1.0.1', time: new Date().toISOString() })
})

/**
 * FC 3.0 HTTP 触发器 handler
 * FC 3.0 使用 event/context 模式，需要返回标准 HTTP 响应对象
 */
export async function handler(event: string, context: any) {
  try {
    // FC 3.0 HTTP 触发器 event 可能是字符串、Buffer 或对象
    let httpTrigger: any
    if (Buffer.isBuffer(event)) {
      httpTrigger = JSON.parse(event.toString('utf-8'))
    } else if (typeof event === 'string') {
      httpTrigger = JSON.parse(event)
    } else {
      httpTrigger = event
    }

    // 构建完整的请求 URL
    const protocol = httpTrigger.headers?.['x-forwarded-proto'] || 'https'
    const host = httpTrigger.headers?.host || httpTrigger.headers?.Host || context?.host || 'localhost'
    const rawPath = httpTrigger.rawPath || httpTrigger.path || '/'
    const query = httpTrigger.queryParameters || {}
    const queryString = Object.keys(query).length > 0
      ? '?' + new URLSearchParams(query).toString()
      : ''
    const url = `${protocol}://${host}${rawPath}${queryString}`

    // 构建 Request headers
    const headers = new Headers()
    if (httpTrigger.headers) {
      for (const [key, value] of Object.entries(httpTrigger.headers)) {
        if (value !== undefined && value !== null) {
          headers.set(key, String(value))
        }
      }
    }

    // 构建 Request init
    const finalMethod = httpTrigger.httpMethod || httpTrigger.method || httpTrigger.requestContext?.http?.method || 'GET'
    const requestInit: RequestInit = {
      method: finalMethod,
      headers,
    }

    // 处理请求体
    if (httpTrigger.body) {
      let body = typeof httpTrigger.body === 'string'
        ? httpTrigger.body
        : JSON.stringify(httpTrigger.body)
      // FC 3.0 可能对 body 做 base64 编码
      if (httpTrigger.isBase64Encoded) {
        body = Buffer.from(body, 'base64').toString('utf-8')
      }
      requestInit.body = body
    }

    // 调用 Hono 处理请求
    const request = new Request(url, requestInit)
    const response = await app.fetch(request)

    // 读取响应体
    const responseBody = await response.text()

    // 构建 FC 3.0 标准响应
    const responseHeaders: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value
    })
    responseHeaders['content-disposition'] = 'inline'

    return {
      statusCode: response.status,
      headers: responseHeaders,
      body: responseBody,
    }

  } catch (err: any) {
    console.error('FC Handler error:', err)
    return {
      statusCode: 500,
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        code: 500,
        error: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
      }),
    }
  }
}
