# Appliance API

家电搜索系统后端 API，基于 Hono + PostgreSQL 构建，部署在阿里云函数计算 (FC 3.0)。

## 线上地址

| 服务   | 地址                                      |
|------|-----------------------------------------|
| API  | https://appliance-api.cheapgo.top       |
| 管理后台 | https://appliance-api.cheapgo.top/admin |
| 静态资源 | https://static.cheapgo.top (CDN)        |

## 技术栈

- **运行时**: Node.js 20
- **框架**: [Hono](https://hono.dev/)
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **数据库**: 阿里云 RDS PostgreSQL 18 (Serverless) + pg_jieba 中文分词
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
│   ├── db/                   # 数据库（schema / seed / 查询）
│   │   ├── schema.ts         # Drizzle schema 定义
│   │   ├── drizzle.ts        # Drizzle 客户端
│   │   ├── queries.ts        # 类型安全查询函数
│   │   ├── index.ts          # 连接池 (兼容旧代码)
│   │   ├── seed.ts           # 初始化种子数据
│   │   ├── snapshots/        # category_params 快照
│   │   ├── migrate-search-vector.ts  # 全文搜索环境安装
│   │   └── fill-pinyin.ts    # 拼音补全
│   ├── utils/
│   │   └── oss.ts            # 阿里云 OSS 上传工具
│   ├── middleware/
│   │   └── auth.ts           # JWT 认证中间件
│   ├── fc-handler.ts         # FC 3.0 入口
│   └── index.ts              # 本地开发入口
├── scripts/                  # 打包与数据导入脚本
├── drizzle/                  # Drizzle migration 文件
├── s.yaml                    # Serverless Devs 配置
├── drizzle.config.ts         # Drizzle Kit 配置
├── .github/workflows/
│   ├── deploy.yml            # 代码部署
│   └── renew-ssl.yml         # SSL 证书续签
└── package.json
```

## 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填入数据库连接信息

# 3. 初始化数据库 (首次)
npm run db:push                 # Drizzle 推送 schema
npm run db:seed                 # 灌入种子
npm run migrate:search-vector   # 全文搜索（空库/新机一次）

# 4. 导入本地整理数据（可选）
npm run import:zol-ac
npm run fill:pinyin
npm run check:etl

# 5. 启动开发服务器
npm run dev
# 访问 http://localhost:3000
```

### 环境变量

| 变量名                        | 说明                                     | 必填 |
|----------------------------|----------------------------------------|----|
| `DB_HOST`                  | 数据库地址                                  | ✅  |
| `DB_PORT`                  | 数据库端口 (默认 5432)                        |    |
| `DB_NAME`                  | 数据库名                                   | ✅  |
| `DB_USER`                  | 数据库用户                                  | ✅  |
| `DB_PASSWORD`              | 数据库密码                                  | ✅  |
| `JWT_SECRET`               | JWT 密钥                                 | ✅  |
| `ALIYUN_ACCESS_KEY_ID`     | 阿里云 AK (图片上传)                          | ✅  |
| `ALIYUN_ACCESS_KEY_SECRET` | 阿里云 SK (图片上传)                          | ✅  |
| `CDN_DOMAIN`               | CDN 域名 (默认 https://static.cheapgo.top) |    |

## 管理后台

访问 `/admin`，默认账号 `admin / admin123`。

### 功能模块

| 模块       | 说明                                   |
|----------|--------------------------------------|
| 📊 仪表盘   | 数据概览、分类统计、热门搜索、最近产品                  |
| 📦 产品管理  | CRUD + 图片上传 (拖拽暂存, 提交时传 OSS)         |
| 📂 分类管理  | 16 个家电分类, 支持层级, 带 icon               |
| ⚙️ 参数规范  | 定义每个品类的参数 (enum/number/text, 可筛选/排序) |
| 🖼️ 图片管理 | 查看/编辑/删除产品图片, 支持按类型筛选                |
| 👥 用户管理  | 超级管理员专属                              |
| 📋 操作日志  | 记录登录、增删改操作                           |

### 管理后台 API

| 方法              | 路径                                         | 说明                   |
|-----------------|--------------------------------------------|----------------------|
| POST            | `/api/admin/login`                         | 登录 (返回 JWT + Cookie) |
| GET             | `/api/admin/products`                      | 产品列表                 |
| POST            | `/api/admin/products`                      | 新增产品                 |
| PUT             | `/api/admin/products/:id`                  | 编辑产品                 |
| DELETE          | `/api/admin/products/:id`                  | 删除产品 (软删除)           |
| GET             | `/api/admin/categories`                    | 分类列表 (树形)            |
| POST/PUT/DELETE | `/api/admin/categories/:id`                | 分类 CRUD              |
| GET             | `/api/admin/category-params?category_id=X` | 品类参数规范               |
| POST/PUT/DELETE | `/api/admin/category-params/:id`           | 参数规范 CRUD            |
| GET             | `/api/admin/product-images?product_id=X`   | 产品图片列表               |
| POST/PUT/DELETE | `/api/admin/product-images/:id`            | 图片 CRUD              |
| POST            | `/api/admin/upload/image`                  | 上传图片到 OSS            |
| GET             | `/api/admin/stats/overview`                | 统计概览                 |
| GET             | `/api/admin/logs`                          | 操作日志                 |

### 认证机制

后台 SSR 页面用 Cookie (`admin_token`, path `/`)，API 接口支持 Bearer Token 和 Cookie 两种方式，认证中间件优先读
Authorization header，没有则读 Cookie。

## 公开 API

| 方法  | 路径                         | 说明                |
|-----|----------------------------|-------------------|
| GET | `/api/search?keyword=关键词`  | 搜索产品 (支持多字段、多关键词) |
| GET | `/api/detail?id=xxx`       | 产品详情              |
| GET | `/api/suggest?keyword=关键词` | 搜索建议              |
| GET | `/api/recommend`           | 推荐产品              |
| GET | `/api/categories`          | 分类列表              |
| GET | `/api/brands`              | 品牌列表              |

### 搜索功能

基于 PostgreSQL `pg_jieba` 中文分词扩展实现全文搜索。

**搜索字段（当前实现）：**

- 产品名称 (`name`)
- 品牌 (`brand`)
- 型号 (`model`)
- 产品参数 (`params`) — 如「变频」「一级」「1.5匹」
- 分类名、拼音等（见搜索 SQL / ILIKE 兜底）

> `search_vector` 由触发器 `products_search_vector_trigger` 在写入时自动维护（
`name + brand + model + params`）。导入脚本不再手写覆盖该字段。

**搜索逻辑：**

- 多关键词用空格分隔，使用 AND 逻辑（所有词都要命中）
- 每个词可在名称/品牌/型号/参数等字段命中

**示例：**

| 搜索词     | 结果       | 说明           |
|---------|----------|--------------|
| `格力`    | 格力相关产品   | 品牌/名称匹配      |
| `变频`    | 变频空调等    | 参数匹配（params） |
| `美的 一级` | 美的一级能效产品 | 联合搜索         |

## 图片存储

### 本地开发（当前）

只做主图：`products.main_image = /local-images/{id}.jpg`  
文件在 `~/Desktop/crawler_test/images-data/`（**不在项目内**，可用 `IMAGE_STAGING_DIR` 覆盖）。  
无 OSS Key 时导入/上传自动落本地（也可设 `IMAGE_STORAGE=local`）。缺主图时重跑 `npm run import:zol-ac`。

示例：`http://localhost:3000/local-images/3819.jpg`

### 线上（以后）

有 OSS Key 时，上传/导入走 `image-oss-pipeline`，`main_image` 写 CDN URL。

| 字段                          | 本地                              | 线上      |
|-----------------------------|---------------------------------|---------|
| `products.main_image`       | `/local-images/xxx.jpg`（目前只做主图） | CDN URL |
| `images` / `product_images` | **已删除**                         | 不应再使用   |

### 图片 API

| 方法   | 路径                        | 说明                             |
|------|---------------------------|--------------------------------|
| GET  | `/local-images/*`         | 读桌面 `crawler_test/images-data` |
| POST | `/api/admin/upload/image` | 后台上传（无 Key 时落本地）               |
| GET  | `/api/image/:id`          | 本地有文件则 302 到 `/local-images/`  |

### 管理后台上传

1. Base64 暂存 → 提交
2. 本地：写入 `~/Desktop/crawler_test/images-data`，`main_image=/local-images/...`
3. 有 OSS Key：上传 CDN

校验：扩展名与 MIME 白名单、≤ 5MB。

### 运维脚本

#### ZOL 空调导入

脚本：`scripts/import-zol-air-condition.ts`（值归一化：`src/utils/normalize-param-value.ts`）

```bash
# 从爬虫 JSON 导入（默认 ~/Desktop/crawler_test/data；含白名单 + 值归一化）
npm run import:zol-ac

# 预览导入，不写库
npx tsx scripts/import-zol-air-condition.ts --dry-run

# 指定数据目录
npx tsx scripts/import-zol-air-condition.ts --dir /path/to/data

# 只回刷：从爬虫 JSON 再 Transform（按需入座 + 例外），不重导图片
npm run import:zol-ac:normalize
```

ETL 约定：

| 层         | 字段 / 产物                                               | 说明                |
|-----------|-------------------------------------------------------|-------------------|
| Extract   | 桌面爬虫 JSON                                             | 原材料，**不进库**       |
| Transform | `products.params`                                     | 白名单 + 入座结果        |
| 例外        | `import_exceptions`                                   | 未知键 / 入不了座 / 规则丢弃 |
| 规范        | `src/db/snapshots/category-params-air-condition.json` | seed 对齐           |
| 图片        | `products.main_image`                                 | 仅主图 URL           |

规则简述：白名单过滤 → `PARAM_MAP` 异名翻译 → 枚举/布尔**按需入座**；对不上的不硬塞。新批次会把同平台旧
open 标为 `superseded`。设计说明见知识库「家电 · 项目总览」。

**scripts/**

| 脚本                                   | 说明                    | 命令                               |
|--------------------------------------|-----------------------|----------------------------------|
| `package.js`                         | 打包部署产物                | `npm run package`                |
| `import-zol-air-condition.ts`        | 导入 ZOL 空调 / 回刷 params | 见上方「ZOL 空调导入」                    |
| `check-etl.ts`                       | ZOL 空调 ETL 质检         | `npm run check:etl`              |
| `export-category-params-snapshot.ts` | 导出 category_params 快照 | `npm run export:category-params` |
| `lib/import-exceptions.ts`           | 例外写入（被导入脚本引用）         | —                                |

**src/db/**

| 脚本                         | 说明                     | 命令                                        |
|----------------------------|------------------------|-------------------------------------------|
| `seed.ts`                  | 分类/管理员/参数规范种子数据        | `npm run db:seed`                         |
| `migrate-search-vector.ts` | 全文搜索环境（pg_jieba + GIN） | `npm run migrate:search-vector`           |
| `fill-pinyin.ts`           | 补拼音字段                  | `npm run fill:pinyin`                     |
| `update-admin-password.ts` | 更新管理员密码                | `npx tsx src/db/update-admin-password.ts` |

## 数据库命令

| 命令                                   | 说明                         |
|--------------------------------------|----------------------------|
| `npm run db:push`                    | 推送 schema 到数据库（本地整理用）      |
| `npm run db:seed`                    | 灌入种子数据                     |
| `npm run migrate:search-vector`      | 安装全文搜索（空库/新机一次）            |
| `npm run fill:pinyin`                | 导入后补拼音                     |
| `npm run db:generate` / `db:migrate` | 生产 migration（上线前再写，本地不必依赖） |

## 部署

代码推送到 `main` 分支自动触发 GitHub Actions 部署到 FC：

```bash
git add .
git commit -m "feat: 新功能"
git push origin main
# 自动构建 + 部署到 FC
```

### 部署流程 (deploy.yml)

1. `npm ci` + `npm run build`（TypeScript 编译到 `dist/`）
2. `npm run package`（`dist/` + 生产依赖 → `code.zip`，与本地一致）
3. `s deploy`（Serverless Devs 部署到 FC）

### SSL 证书

通配符证书 `*.cheapgo.top`，通过 acme.sh + Let's Encrypt 签发，每 90 天自动续期，续期后自动推送到 CDN。

手动触发续签：GitHub → Actions → Renew SSL Certificate → Run workflow

## 基础设施

| 资源         | 说明                                               |
|------------|--------------------------------------------------|
| RDS 实例     | `pgm-wz926p594292r913` (cn-shenzhen, Serverless) |
| OSS Bucket | `cheapgo-assets` (cn-shenzhen, public-read)      |
| CDN 域名     | `static.cheapgo.top` (源站 OSS)                    |
| FC 函数      | `appliance-api` (cn-shenzhen, Node.js 20)        |
| 域名         | `cheapgo.top` (阿里云云解析 DNS)                       |
| SSL 证书     | `*.cheapgo.top` (Let's Encrypt 通配符)              |

## 相关仓库

| 仓库                                                                                | 说明           |
|-----------------------------------------------------------------------------------|--------------|
| [home-appliances/appliance-web](https://github.com/home-appliances/appliance-web) | 前端 (Taro H5) |
