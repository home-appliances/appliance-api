/**
 * 阿里云函数计算 (FC 3.0) HTTP 触发器入口
 * 将 FC 的 event/context 转换为 Hono 的 Request/Response
 * 更新时间: 2026-07-02 03:30
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
  return c.json({ message: '家电搜索API服务运行中', version: '1.0.1', time: new Date().toISOString() })
})

// 临时迁移接口，执行后删除
app.post('/api/migrate-v2', async (c) => {
  try {
    const { pool } = await import('./db/index.js')
    const sql = `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admins' AND column_name='name') THEN ALTER TABLE admins ADD COLUMN name TEXT; END IF; IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admins' AND column_name='email') THEN ALTER TABLE admins ADD COLUMN email TEXT; END IF; IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admins' AND column_name='phone') THEN ALTER TABLE admins ADD COLUMN phone TEXT; END IF; IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admins' AND column_name='role') THEN ALTER TABLE admins ADD COLUMN role TEXT DEFAULT 'admin'; END IF; IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admins' AND column_name='status') THEN ALTER TABLE admins ADD COLUMN status TEXT DEFAULT 'active'; END IF; IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admins' AND column_name='avatar') THEN ALTER TABLE admins ADD COLUMN avatar TEXT; END IF; IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admins' AND column_name='remark') THEN ALTER TABLE admins ADD COLUMN remark TEXT; END IF; IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admins' AND column_name='updated_at') THEN ALTER TABLE admins ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW(); END IF; END $$; UPDATE admins SET name=COALESCE(name,'系统管理员'),email=COALESCE(email,'admin@appliance.com'),role=COALESCE(role,'super_admin'),status=COALESCE(status,'active'),avatar=COALESCE(avatar,'SA') WHERE username='admin'; CREATE TABLE IF NOT EXISTS operation_logs (id BIGSERIAL PRIMARY KEY,admin_id BIGINT REFERENCES admins(id),operator TEXT NOT NULL,ip TEXT,type TEXT NOT NULL,target TEXT,result TEXT DEFAULT 'success',detail TEXT,created_at TIMESTAMPTZ DEFAULT NOW()); CREATE INDEX IF NOT EXISTS idx_operation_logs_created_at ON operation_logs (created_at DESC); CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY,value JSONB NOT NULL,updated_at TIMESTAMPTZ DEFAULT NOW()); INSERT INTO system_settings (key,value) VALUES ('basic','{"systemName":"Appliance Admin"}'),('security','{"pwdMinLength":8}'),('data','{"defaultPageSize":20}'),('notification','{"alertEnabled":true}') ON CONFLICT (key) DO NOTHING; DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='deleted_at') THEN ALTER TABLE products ADD COLUMN deleted_at TIMESTAMPTZ; END IF; IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='deleted_by') THEN ALTER TABLE products ADD COLUMN deleted_by TEXT; END IF; END $$;`
    await pool.query(sql)
    return c.json({ success: true, message: 'v2 迁移完成' })
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500)
  }
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

    // 调试：返回请求信息
    if (rawPath === '/api/debug') {
      return {
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          httpMethod: httpTrigger.httpMethod,
          method: httpTrigger.method,
          rawPath: httpTrigger.rawPath,
          requestContext: httpTrigger.requestContext,
          keys: Object.keys(httpTrigger),
        }),
      }
    }

    // 构建 Request init
    const finalMethod = httpTrigger.httpMethod || httpTrigger.method || 'GET'
    const requestInit: RequestInit = {
      method: finalMethod,
      headers,
    }

    // 处理请求体
    if (httpTrigger.body) {
      const body = typeof httpTrigger.body === 'string'
        ? httpTrigger.body
        : JSON.stringify(httpTrigger.body)
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
