# scripts/

运维与数据导入脚本（一次性排查/修图脚本已清理）。

| 脚本 | 说明 | 命令 |
|------|------|------|
| `package.js` | 打包部署产物 `code.zip` | `npm run package` |
| `migrate-main-image.ts` | 为产品补全 `main_image` / `image_id` | `npm run migrate:main-image` |
| `import-data.ts` | 将 crawler JSON 导入 PostgreSQL | `npm run import:data` |
| `import-zol-air-condition.ts` | 导入 ZOL 空调爬虫数据 | `npm run import:zol-ac` |
| `fix-unknown-brands.ts` | 从产品名提取并修复「未知品牌」 | `npm run fix:unknown-brands` |

更多数据库迁移与维护脚本在 `src/db/`（由 `package.json` 的 `migrate:*` / `db:*` 引用）。
