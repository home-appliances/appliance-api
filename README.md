# Appliance API

家电搜索系统后端 API，基于 Hono + PostgreSQL 构建，部署在阿里云函数计算 (FC 3.0)。

## 线上地址

| 服务 | 地址 |
|------|------|
| API | https://appliance-api.cheapgo.top |
| 管理后台 | https://appliance-api.cheapgo.top/admin |
| 静态资源 | https://static.cheapgo.top (CDN) |

## 技术栈

- **运行时**: Node.js 20
- **框架**: [Hono](https://hono.dev/)
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **数据库**: 阿里云 RDS PostgreSQL 18 (Serverless)
- **对象存储**: 阿里云 OSS (`cheapgo-assets`)
- **CDN**: 阿里云 CDN (`static.cheapgo.top`)
- **部署**: 阿里云函数计算 (FC 3.0)
- **CI/CD**: GitHub Actions + Serverless Devs
- **SSL**: Let's Encrypt 通配符证书 (`*.cheapgo.top`)

## 项目结构

```
appliance-api/
├── src/
│   ├── admin/                # 管理后台 (SSR)
│   │   ├── pages/            # 页面模板
│   │   │   ├── dashboard.ts  # 仪表盘
│   │   │   ├── products.ts   # 产品管理 (含图片上传)
│   │   │   ├── categories.ts # 分类管理
│   │   │   ├── category-params.ts  # 品类参数规范
│   │   │   ├── product-images.ts   # 图片管理
│   │   │   ├── users.ts      # 用户管理
│   │   │   ├── logs.ts       # 操作日志
│   │   │   └── login.ts      # 登录
│   │   ├── routes.ts         # SSR 路由
│   │   ├── layout.ts         # 布局模板
│   │   └── middleware.ts     # 认证中间件
│   ├── routes/               # API 路由
│   │   ├── search.ts         # 搜索接口
│   │   ├── detail.ts         # 详情接口
│   │   ├── category.ts       # 分类接口
│   │   └── admin/            # 管理后台 API
│   │       ├── products.ts   # 产品 CRUD
│   │       ├── categories.ts # 分类 CRUD
│   │       ├── category-params.ts  # 参数规范 CRUD
│   │       ├── product-images.ts   # 图片 CRUD
│   │       ├── upload.ts     # 图片上传 API
│   │       ├── auth.ts       # 认证 API
│   │       └── stats.ts      # 统计 API
│   ├── db/                   # 数据库
│   │   ├── schema.ts         # Drizzle schema 定义
│   │   ├── drizzle.ts        # Drizzle 客户端
│   │   ├── queries.ts        # 类型安全查询函数
│   │   ├── index.ts          # 连接池 (兼容旧代码)
│   │   └── seed.ts           # 初始化种子数据
│   ├── utils/
│   │   └── oss.ts            # 阿里云 OSS 上传工具
│   ├── middleware/
│   │   └── auth.ts           # JWT 认证中间件
│   ├── fc-handler.ts         # FC 3.0 入口
│   └── index.ts              # 本地开发入口
├── drizzle/                  # Drizzle migration 文件
├── s.yaml                    # Serverless Devs 配置
├── drizzle.config.ts         # Drizzle Kit 配置
├── .github/workflows/
│   ├── deploy.yml            # 代码部署
│   └── renew-ssl.yml         # SSL 证书续签
└── package.json
```

## 数据库设计

### 核心表

| 表 | 说明 |
|----|------|
| `products` | 产品主表 (name/brand/model/category_id/price/params JSONB) |
| `categories` | 分类表 (支持层级, 带 icon) |
| `category_params` | 品类参数规范 (定义每个品类有哪些参数、类型、是否可筛选) |
| `product_images` | 产品图片 (支持多类型: main/display/detail/scene, 可排序) |
| `admins` | 管理员 |
| `search_logs` | 搜索日志 |
| `operation_logs` | 操作日志 |
| `system_settings` | 系统设置 |
| `crawler_tasks` | 爬虫任务 |

### 数据库命令

| 命令 | 说明 |
|------|------|
| `npm run db:push` | 推送 schema 到数据库 (开发用, 快速) |
| `npm run db:generate` | 从 schema 生成 migration SQL 文件 |
| `npm run db:migrate` | 执行 migration 文件 (生产用) |
| `npm run db:seed` | 灌入初始数据 (16 个分类、admin 账号、21 条参数规范) |

## 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填入数据库连接信息

# 3. 初始化数据库 (首次)
npm run db:push        # Drizzle 推送 schema 到数据库
npm run db:seed        # 灌入初始数据

# 4. 启动开发服务器
npm run dev
# 访问 http://localhost:3000
```

### 环境变量

| 变量名 | 说明 | 必填 |
|--------|------|------|
| `DB_HOST` | 数据库地址 | ✅ |
| `DB_PORT` | 数据库端口 (默认 5432) | |
| `DB_NAME` | 数据库名 | ✅ |
| `DB_USER` | 数据库用户 | ✅ |
| `DB_PASSWORD` | 数据库密码 | ✅ |
| `JWT_SECRET` | JWT 密钥 | ✅ |
| `ALIYUN_ACCESS_KEY_ID` | 阿里云 AK (图片上传) | ✅ |
| `ALIYUN_ACCESS_KEY_SECRET` | 阿里云 SK (图片上传) | ✅ |
| `CDN_DOMAIN` | CDN 域名 (默认 https://static.cheapgo.top) | |

## 管理后台

访问 `/admin`，默认账号 `admin / admin123`。

### 功能模块

| 模块 | 说明 |
|------|------|
| 📊 仪表盘 | 数据概览、分类统计、热门搜索、最近产品 |
| 📦 产品管理 | CRUD + 图片上传 (拖拽暂存, 提交时传 OSS) |
| 📂 分类管理 | 16 个家电分类, 支持层级, 带 icon |
| ⚙️ 参数规范 | 定义每个品类的参数 (enum/number/text, 可筛选/排序) |
| 🖼️ 图片管理 | 查看/编辑/删除产品图片, 支持按类型筛选 |
| 👥 用户管理 | 超级管理员专属 |
| 📋 操作日志 | 记录登录、增删改操作 |

### 管理后台 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/admin/login` | 登录 (返回 JWT + Cookie) |
| GET | `/api/admin/products` | 产品列表 |
| POST | `/api/admin/products` | 新增产品 |
| PUT | `/api/admin/products/:id` | 编辑产品 |
| DELETE | `/api/admin/products/:id` | 删除产品 (软删除) |
| GET | `/api/admin/categories` | 分类列表 (树形) |
| POST/PUT/DELETE | `/api/admin/categories/:id` | 分类 CRUD |
| GET | `/api/admin/category-params?category_id=X` | 品类参数规范 |
| POST/PUT/DELETE | `/api/admin/category-params/:id` | 参数规范 CRUD |
| GET | `/api/admin/product-images?product_id=X` | 产品图片列表 |
| POST/PUT/DELETE | `/api/admin/product-images/:id` | 图片 CRUD |
| POST | `/api/admin/upload/image` | 上传图片到 OSS |
| GET | `/api/admin/stats/overview` | 统计概览 |
| GET | `/api/admin/logs` | 操作日志 |

### 认证机制

后台 SSR 页面用 Cookie (`admin_token`, path `/`)，API 接口支持 Bearer Token 和 Cookie 两种方式，认证中间件优先读 Authorization header，没有则读 Cookie。

## 公开 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/search?q=关键词` | 搜索产品 |
| GET | `/api/detail?id=xxx` | 产品详情 |
| GET | `/api/suggest?q=关键词` | 搜索建议 |
| GET | `/api/recommend` | 推荐产品 |
| GET | `/api/categories` | 分类列表 |
| GET | `/api/brands` | 品牌列表 |

## 图片上传

图片上传到阿里云 OSS (`cheapgo-assets` bucket)，通过 CDN (`static.cheapgo.top`) 分发。

### 上传流程

1. 前端拖拽/选择图片 → 转 Base64 暂存 (绕过 FC multipart 二进制损坏问题)
2. 提交产品表单时，图片 Base64 随产品数据一起提交
3. 后端 Base64 解码 → 校验 (大小/格式/MIME) → 上传 OSS → 建 product_images 关联记录

### 图片格式校验 (前后端一致)

- 扩展名白名单: `.jpg` `.jpeg` `.png` `.gif` `.webp`
- MIME 白名单: `image/jpeg` `image/png` `image/gif` `image/webp`
- 扩展名与 MIME 必须匹配 (防止改扩展名绕过)
- 大小 ≤ 5MB，非空

### OSS Bucket 配置

- Bucket: `cheapgo-assets` (cn-shenzhen)
- ACL: public-read
- 自定义域名: `static.cheapgo.top` (CDN 加速)
- CORS: 允许 `admin.cheapgo.top` (后台上传)

## 部署

代码推送到 `main` 分支自动触发 GitHub Actions 部署到 FC：

```bash
git add .
git commit -m "feat: 新功能"
git push origin main
# 自动构建 + 部署到 FC
```

### 部署流程 (deploy.yml)

1. `npm ci` + `npm run build` (TypeScript 编译)
2. 打包 `code.zip` (dist + src + SQL + node_modules)
3. `s deploy` (Serverless Devs 部署到 FC)

### SSL 证书

通配符证书 `*.cheapgo.top`，通过 acme.sh + Let's Encrypt 签发，每 90 天自动续期，续期后自动推送到 CDN。

手动触发续签：GitHub → Actions → Renew SSL Certificate → Run workflow

## 基础设施

| 资源 | 说明 |
|------|------|
| RDS 实例 | `pgm-wz926p594292r913` (cn-shenzhen, Serverless) |
| OSS Bucket | `cheapgo-assets` (cn-shenzhen, public-read) |
| CDN 域名 | `static.cheapgo.top` (源站 OSS) |
| FC 函数 | `appliance-api` (cn-shenzhen, Node.js 20) |
| 域名 | `cheapgo.top` (阿里云云解析 DNS) |
| SSL 证书 | `*.cheapgo.top` (Let's Encrypt 通配符) |

## 相关仓库

| 仓库 | 说明 |
|------|------|
| [home-appliances/appliance-web](https://github.com/home-appliances/appliance-web) | 前端 (Taro H5) |
