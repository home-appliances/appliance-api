# Appliance API

家电搜索系统后端 API，基于 Hono + PostgreSQL 构建，部署在阿里云函数计算 (FC 3.0)。

## 线上地址

| 服务 | 地址 |
|------|------|
| API | https://appliance-api.cheapgo.top |
| 管理后台 | https://appliance-api.cheapgo.top/admin |

## 技术栈

- **运行时**: Node.js 20
- **框架**: [Hono](https://hono.dev/)
- **数据库**: 阿里云 RDS PostgreSQL
- **部署**: 阿里云函数计算 (FC 3.0)
- **CI/CD**: GitHub Actions + Serverless Devs
- **SSL**: Let's Encrypt 自动续签

## 项目结构

```
appliance-api/
├── src/
│   ├── admin/              # 管理后台 (SSR)
│   │   ├── css/            # 样式文件
│   │   ├── pages/          # 页面模板
│   │   ├── routes.ts       # SSR 路由
│   │   ├── layout.ts       # 布局模板
│   │   └── middleware.ts   # 认证中间件
│   ├── routes/             # API 路由
│   │   ├── search.ts       # 搜索接口
│   │   ├── detail.ts       # 详情接口
│   │   ├── suggest.ts      # 搜索建议
│   │   ├── recommend.ts    # 推荐数据
│   │   ├── category.ts     # 分类接口
│   │   ├── image.ts        # 图片接口
│   │   └── admin/          # 管理后台 API
│   ├── db/                 # 数据库
│   │   ├── index.ts        # 连接池
│   │   └── *.sql           # 迁移脚本
│   ├── middleware/          # 中间件
│   │   └── auth.ts         # JWT 认证
│   ├── fc-handler.ts       # FC 3.0 入口
│   └── index.ts            # 本地开发入口
├── s.yaml                  # Serverless Devs 配置
├── .github/workflows/
│   ├── deploy.yml          # 代码部署
│   └── renew-ssl.yml       # SSL 证书续签
└── package.json
```

## 本地开发

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入数据库连接信息

# 启动开发服务器
npm run dev
# 访问 http://localhost:3000
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/search?q=关键词` | 搜索产品 |
| GET | `/api/detail?id=xxx` | 产品详情 |
| GET | `/api/suggest?q=关键词` | 搜索建议 |
| GET | `/api/recommend` | 推荐产品 |
| GET | `/api/categories` | 分类列表 |
| GET | `/api/brands` | 品牌列表 |
| GET | `/api/image/proxy?url=xxx` | 图片代理 |

## 管理后台 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/admin/login` | 登录 |
| GET | `/api/admin/users` | 用户列表 |
| GET | `/api/admin/products` | 产品列表 |
| GET | `/api/admin/stats/overview` | 统计概览 |
| GET | `/api/admin/logs` | 操作日志 |

## 部署

代码推送到 `main` 分支会自动触发 GitHub Actions 部署：

```bash
git add .
git commit -m "feat: 新功能"
git push origin main
# 自动部署到 FC
```

## SSL 证书

使用 Let's Encrypt 免费证书，通过 GitHub Actions 每 60 天自动续签。

手动触发续签：GitHub → Actions → Renew SSL Certificate → Run workflow

## 环境变量

| 变量名 | 说明 |
|--------|------|
| `DB_HOST` | 数据库地址 |
| `DB_PORT` | 数据库端口 |
| `DB_NAME` | 数据库名 |
| `DB_USER` | 数据库用户 |
| `DB_PASSWORD` | 数据库密码 |
| `JWT_SECRET` | JWT 密钥 |
| `NODE_ENV` | 运行环境 |

## 相关仓库

| 仓库 | 说明 |
|------|------|
| [home-appliances/appliance-web](https://github.com/home-appliances/appliance-web) | 前端 (Taro H5) |
