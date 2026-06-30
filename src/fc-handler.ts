/**
 * 阿里云函数计算 (FC) HTTP 触发器入口
 * 将 FC 的 req/resp 转换为 Hono 的 Request/Response
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import search from './routes/search.js'
import detail from './routes/detail.js'
import suggest from './routes/suggest.js'
import recommend from './routes/recommend.js'
import admin from './routes/admin/index.js'
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
app.route('/', admin)
app.route('/api/air-conditioners', airConditioners)
app.route('/', imageProxy)
app.route('/', category)
app.route('/', image)

// 根路径测试
app.get('/', (c) => {
  return c.json({ message: '家电搜索API服务运行中' })
})

/**
 * FC HTTP 触发器 handler
 * 兼容 FC 3.0 HTTP 触发器的 req/resp 接口
 */
export async function handler(req: any, resp: any, context: any) {
  try {
    // 构建完整的请求 URL
    const protocol = req.headers['x-forwarded-proto'] || 'https'
    const host = req.headers.host || req.headers.Host || ''
    const url = `${protocol}://${host}${req.url || req.path || '/'}`

    // 构建 Request headers
    const headers = new Headers()
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined && value !== null) {
        headers.set(key, String(value))
      }
    }

    // 构建 Request init
    const requestInit: RequestInit = {
      method: req.method || 'GET',
      headers,
    }

    // 处理请求体（非 GET/HEAD）
    if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
      if (req.body !== undefined && req.body !== null) {
        requestInit.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
      }
    }

    // 调用 Hono 处理请求
    const request = new Request(url, requestInit)
    const response = await app.fetch(request)

    // 设置状态码
    resp.setStatusCode(response.status)

    // ✅ 关键：只复制安全的 header，避免 FC 兼容问题
    const safeHeaders = ['content-type', 'cache-control', 'etag', 'last-modified', 'x-request-id']
    for (const h of safeHeaders) {
      const val = response.headers.get(h)
      if (val) {
        resp.setHeader(h, val)
      }
    }

    // ✅ 确保 Content-Type 被正确设置
    const contentType = response.headers.get('content-type')
    if (!contentType) {
      // 根据请求路径推断 Content-Type
      const path = req.url || req.path || ''
      if (path.includes('/api/') || path === '/') {
        resp.setHeader('content-type', 'application/json; charset=utf-8')
      } else {
        resp.setHeader('content-type', 'text/plain; charset=utf-8')
      }
    }

    // ✅ 确保不是 attachment，防止浏览器触发下载
    resp.setHeader('content-disposition', 'inline')

    // 读取响应体并发送
    const body = await response.text()
    resp.send(body)

  } catch (err: any) {
    console.error('FC Handler error:', err)
    resp.setStatusCode(500)
    resp.setHeader('content-type', 'application/json; charset=utf-8')
    resp.send(JSON.stringify({
      code: 500,
      error: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    }))
  }
}
