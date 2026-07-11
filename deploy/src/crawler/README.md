# 家电数据爬虫

基于 PConline 的家电数据爬虫，用于爬取冰箱产品数据并存入 PostgreSQL。

## 功能特性

- ✅ **数据完整性**：爬取产品名称、品牌、型号、参数、价格、评分、图片
- ✅ **断点续爬**：支持中断后恢复，避免重复爬取
- ✅ **失败重试**：失败产品自动记录，支持手动重试
- ✅ **限流控制**：每秒最多 3 个请求，避免被封 IP
- ✅ **异步图片下载**：图片异步下载并存入数据库
- ✅ **结构化日志**：完整的日志记录，便于排查问题
- ✅ **进度报告**：实时显示爬取进度

## 技术栈

- **运行时**：Node.js
- **语言**：TypeScript
- **数据库**：PostgreSQL
- **HTTP 客户端**：原生 fetch API
- **日志**：winston

## 遵循的最佳实践

### supabase-postgres-best-practices

- ✅ 使用 `BIGINT IDENTITY` 主键
- ✅ 使用 `TEXT` 而非 `VARCHAR(n)`
- ✅ 使用 `TIMESTAMPTZ` 存储时间
- ✅ 使用 `JSONB` 存储灵活参数
- ✅ GIN 索引支持 JSONB 查询
- ✅ 连接池管理
- ✅ 批量插入优化
- ✅ 参数化查询防注入

### native-data-fetching

- ✅ 使用 `fetch` 而非 `axios`
- ✅ 完整的错误处理
- ✅ 指数退避重试
- ✅ 请求限流
- ✅ 环境变量配置

### security-best-practices

- ✅ API 密钥用环境变量，不硬编码
- ✅ 参数化查询防 SQL 注入
- ✅ 不记录敏感信息（密码）
- ✅ 输入验证（品牌、产品 ID）
- ✅ URL 验证

## 安装

```bash
cd hono
npm install
```

## 配置

创建 `.env` 文件：

```bash
# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=appliance_db
DB_USER=postgres
DB_PASSWORD=your_password

# 爬虫配置
CRAWLER_BASE_URL=https://product.pconline.com.cn
CRAWLER_MAX_CONCURRENT=3
CRAWLER_MAX_RETRIES=3
CRAWLER_RETRY_DELAY=1000
CRAWLER_BATCH_SIZE=50

# 日志级别
LOG_LEVEL=info
```

## 使用

### 1. 初始化数据库

```bash
# 连接 PostgreSQL 后执行
psql -U postgres -d appliance_db -f src/db/schema.sql
```

### 2. 运行爬虫

```bash
# 完整爬取
npx tsx src/crawler/index.ts

# 重试失败产品
npx tsx src/crawler/index.ts --retry

# 查看状态统计
npx tsx src/crawler/index.ts --stats

# 清空状态
npx tsx src/crawler/index.ts --clear
```

## 文件结构

```
hono/src/crawler/
├── index.ts              # 爬虫主入口
├── config.ts             # 配置（环境变量）
├── pconline-client.ts    # PConline API 客户端
├── image-downloader.ts   # 图片异步下载器
├── db-writer.ts          # 数据库写入器
├── html-parser.ts        # HTML 解析器
├── types.ts              # 类型定义
├── utils.ts              # 工具函数
├── logger.ts             # 日志系统
├── progress.ts           # 进度报告
├── resume.ts             # 断点续爬
└── README.md             # 本文件
```

## 数据库表结构

### images 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键，自增 |
| image_data | BYTEA | 图片二进制数据 |
| mime_type | TEXT | MIME 类型 |
| file_size | INTEGER | 文件大小 |
| width | INTEGER | 图片宽度 |
| height | INTEGER | 图片高度 |
| source_url | TEXT | 原始 URL（唯一） |
| created_at | TIMESTAMPTZ | 创建时间 |

### products 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键，自增 |
| name | TEXT | 产品名称 |
| brand | TEXT | 品牌 |
| model | TEXT | 型号 |
| params | JSONB | 所有参数 |
| price | NUMERIC | 价格 |
| rating | NUMERIC | 评分 |
| images | TEXT[] | 图片 URL 数组 |
| image_id | BIGINT | 关联图片 ID |
| source_url | TEXT | 来源 URL（唯一） |
| source_platform | TEXT | 来源平台 |
| last_crawled_at | TIMESTAMPTZ | 最后爬取时间 |
| crawl_count | INTEGER | 爬取次数 |
| created_at | TIMESTAMPTZ | 创建时间 |
| updated_at | TIMESTAMPTZ | 更新时间 |

## 支持的品牌

```
haier, midea, panasonic, siemens, whirlpool,
rongsheng, xinfei, meiling, samsung, hisense,
lg, xiaomi, electrolux, bocsh, toshiba,
tcl, casarte, sharp
```

## 常见问题

### Q: 爬取中断了怎么办？

A: 重新运行爬虫即可，会自动跳过已爬取的产品。

### Q: 如何重试失败的产品？

A: 运行 `npx tsx src/crawler/index.ts --retry`

### Q: 如何查看爬取进度？

A: 运行 `npx tsx src/crawler/index.ts --stats`

### Q: 如何清空状态重新爬取？

A: 运行 `npx tsx src/crawler/index.ts --clear`

### Q: 如何添加新品牌？

A: 在 `config.ts` 的 `brands` 数组中添加品牌名称。

## 注意事项

1. **遵守 robots.txt**：请遵守网站的 robots.txt 规则
2. **合理限流**：不要设置过高的并发数，避免被封 IP
3. **数据用途**：仅用于学习和研究，请勿用于商业用途
4. **法律责任**：爬取数据时请遵守相关法律法规
