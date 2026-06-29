# 图片二进制导入工具

## 概述

将数据库中的图片 URL 下载并转换为二进制数据存储到数据库，避免外部图片链接失效导致图片无法显示。

## 数据规模

- 产品数量：3,403
- 图片总数：70,635
- 预计耗时：1-2 小时

## 使用步骤

### 1. 添加数据库字段

```bash
cd hono
npm run migrate:images
```

这会为 `products` 表添加 `images_binary` 字段（bytea[] 类型）。

### 2. 导入图片二进制数据

```bash
npm run import:images
```

可选参数：
- `--batch-size=100`  批次大小（默认 100）
- `--concurrent=5`    并发下载数量（默认 5）
- `--resume`          从中断处继续

示例：
```bash
# 使用更大的批次和并发
node scripts/import-images.js --batch-size=200 --concurrent=10

# 中断后继续
node scripts/import-images.js --resume
```

### 3. 验证导入结果

```bash
npm run check
```

## 技术细节

- 图片优先存储为 `images_binary` 字段（bytea[] 类型）
- 原 `images` 字段保留作为 URL 备份
- 搜索和详情接口会优先返回二进制图片（data URL 格式）
- 如果二进制图片不存在，降级返回 URL

## 注意事项

1. 需要稳定的网络连接
2. 确保 PostgreSQL 服务正在运行
3. 如果导入中断，使用 `--resume` 参数继续
4. 导入完成后，数据库大小可能增加 5-10 GB
