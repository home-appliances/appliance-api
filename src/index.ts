import { serve } from '@hono/node-server'
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

const port = 3000
const host = '0.0.0.0'
console.log(`🚀 服务启动在 http://${host}:${port}`)

serve({
  fetch: app.fetch,
  port,
  hostname: host
})
