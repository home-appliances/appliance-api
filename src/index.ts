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
  return c.json({ message: '家电搜索API服务运行中', version: '1.0.1', time: new Date().toISOString() })
})

// FC HTTP 触发器 handler
export async function handler(req: any, resp: any, context: any) {
  try {
    const protocol = req.headers['x-forwarded-proto'] || 'https'
    const host = req.headers.host || req.headers.Host || ''
    const url = `${protocol}://${host}${req.url || req.path || '/'}`

    const headers = new Headers()
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined && value !== null) {
        headers.set(key, String(value))
      }
    }

    const requestInit: RequestInit = {
      method: req.method || 'GET',
      headers,
    }

    if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
      if (req.body !== undefined && req.body !== null) {
        requestInit.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
      }
    }

    const request = new Request(url, requestInit)
    const response = await app.fetch(request)

    resp.setStatusCode(response.status)

    const safeHeaders = ['content-type', 'cache-control', 'etag', 'last-modified', 'x-request-id']
    for (const h of safeHeaders) {
      const val = response.headers.get(h)
      if (val) resp.setHeader(h, val)
    }

    const contentType = response.headers.get('content-type')
    if (!contentType) {
      const path = req.url || req.path || ''
      if (path.includes('/api/') || path === '/') {
        resp.setHeader('content-type', 'application/json; charset=utf-8')
      } else {
        resp.setHeader('content-type', 'text/plain; charset=utf-8')
      }
    }

    resp.setHeader('content-disposition', 'inline')

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

// 本地开发：启动独立 HTTP 服务器
// FC 环境下不启动（由 FC 运行时管理请求）
if (!process.env.FC_FUNC_CODE_PATH) {
  import('@hono/node-server').then(({ serve }) => {
    const port = 3000
    const host = '0.0.0.0'
    console.log(`🚀 服务启动在 http://${host}:${port}`)
    serve({
      fetch: app.fetch,
      port,
      hostname: host
    })
  })
}
