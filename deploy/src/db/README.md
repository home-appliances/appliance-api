# 数据库模块

PostgreSQL 连接、Schema、查询与运维脚本。

## 运行时（被 API / Admin 引用）

| 文件 | 说明 |
|------|------|
| `index.ts` | 连接池与查询封装 |
| `queries.ts` | Drizzle 查询 |
| `schema.ts` | Drizzle Schema |
| `drizzle.ts` | Drizzle 客户端 |

## SQL / 迁移

| 文件 | 说明 | 命令 |
|------|------|------|
| `schema.sql` | 主表结构 | `npx tsx src/db/init.ts` |
| `admin-schema.sql` / `admin-schema-v2.sql` | 后台相关表 | `npm run migrate:admin` |
| `migration-fulltext.sql` 等 | 搜索/优化迁移 | `npm run migrate` / `migrate:search` |
| `migrate-search-vector.ts` | search_vector | `npm run migrate:search-vector` |
| `seed.ts` | 分类/管理员/参数规范种子 | `npm run db:seed` |

## 运维脚本

| 文件 | 说明 | 命令 |
|------|------|------|
| `check-data.ts` | 数据概况检查 | `npm run check` |
| `fill-pinyin.ts` | 填充拼音 | `npm run fill:pinyin` |
| `merge-sources.ts` | 多源融合 | `npm run merge` |
| `import-crawler-data.ts` | 导入爬虫 JSON | `npx tsx src/db/import-crawler-data.ts` |
| `import-images.ts` | URL 图片入库 | `npx tsx src/db/import-images.ts` |
| `fix-ac-param-types.ts` | 修正空调参数类型 | `npx tsx src/db/fix-ac-param-types.ts` |
| `update-admin-password.ts` | 更新管理员密码 | `npx tsx src/db/update-admin-password.ts` |
| `run-optimize.ts` | 优化迁移 | `npx tsx src/db/run-optimize.ts` |

更细的迁移说明见 `MIGRATION_README.md`。
