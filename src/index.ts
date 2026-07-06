import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from '@hono/node-server/serve-static'
import { readFile } from 'fs/promises'
import { join } from 'path'
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

// 临时迁移接口，执行后删除
app.post('/api/migrate-v2', async (c) => {
  try {
    const { pool } = await import('./db/index.js')
    const sql = `
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admins' AND column_name='name') THEN ALTER TABLE admins ADD COLUMN name TEXT; END IF;
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admins' AND column_name='email') THEN ALTER TABLE admins ADD COLUMN email TEXT; END IF;
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admins' AND column_name='phone') THEN ALTER TABLE admins ADD COLUMN phone TEXT; END IF;
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admins' AND column_name='role') THEN ALTER TABLE admins ADD COLUMN role TEXT DEFAULT 'admin'; END IF;
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admins' AND column_name='status') THEN ALTER TABLE admins ADD COLUMN status TEXT DEFAULT 'active'; END IF;
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admins' AND column_name='avatar') THEN ALTER TABLE admins ADD COLUMN avatar TEXT; END IF;
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admins' AND column_name='remark') THEN ALTER TABLE admins ADD COLUMN remark TEXT; END IF;
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admins' AND column_name='updated_at') THEN ALTER TABLE admins ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW(); END IF;
END $$;
UPDATE admins SET name=COALESCE(name,'系统管理员'),email=COALESCE(email,'admin@appliance.com'),role=COALESCE(role,'super_admin'),status=COALESCE(status,'active'),avatar=COALESCE(avatar,'SA') WHERE username='admin';
CREATE TABLE IF NOT EXISTS operation_logs (id BIGSERIAL PRIMARY KEY,admin_id BIGINT REFERENCES admins(id),operator TEXT NOT NULL,ip TEXT,type TEXT NOT NULL,target TEXT,result TEXT DEFAULT 'success',detail TEXT,created_at TIMESTAMPTZ DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_operation_logs_created_at ON operation_logs (created_at DESC);
CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY,value JSONB NOT NULL,updated_at TIMESTAMPTZ DEFAULT NOW());
INSERT INTO system_settings (key,value) VALUES ('basic','{"systemName":"Appliance Admin"}'),('security','{"pwdMinLength":8}'),('data','{"defaultPageSize":20}'),('notification','{"alertEnabled":true}') ON CONFLICT (key) DO NOTHING;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='deleted_at') THEN ALTER TABLE products ADD COLUMN deleted_at TIMESTAMPTZ; END IF;
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='deleted_by') THEN ALTER TABLE products ADD COLUMN deleted_by TEXT; END IF;
END $$;`
    await pool.query(sql)
    return c.json({ success: true, message: 'v2 迁移完成' })
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500)
  }
})

// 管理后台静态文件 - 直接通过 HTTP 访问
app.get('/admin', (c) => c.redirect('/admin/index.html'))
app.get('/admin/*', async (c) => {
  const path = c.req.path.replace('/admin/', '')
  const filePath = join(process.cwd(), 'admin-panel', path || 'index.html')
  try {
    const content = await readFile(filePath)
    const ext = path.split('.').pop() || 'html'
    const mimeMap: Record<string, string> = {
      'html': 'text/html; charset=utf-8',
      'css': 'text/css; charset=utf-8',
      'js': 'application/javascript; charset=utf-8',
      'json': 'application/json; charset=utf-8',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'svg': 'image/svg+xml',
    }
    return new Response(content, { headers: { 'content-type': mimeMap[ext] || 'text/plain' } })
  } catch {
    return c.text('Not Found', 404)
  }
})

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
