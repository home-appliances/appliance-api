/**
 * CSV 导出模块
 * 功能：将清洗后的数据导出为 products.csv
 */

import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Product } from './data-cleaner';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// =====================================================
// CSV 转义
// =====================================================

function escapeCsvField(value: string | number | null): string {
  if (value === null || value === undefined) {
    return '';
  }

  const str = String(value);

  // 如果包含逗号、引号或换行，需要用引号包裹
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

// =====================================================
// CSV 导出函数
// =====================================================

export async function exportToCsv(
  products: Product[],
  outputPath?: string
): Promise<string> {
  // 默认输出路径
  const dataDir = join(__dirname, '../../../data');
  const filePath = outputPath || join(dataDir, 'products.csv');

  // 确保目录存在
  await mkdir(dirname(filePath), { recursive: true });

  // CSV 表头
  const headers = [
    'id',
    'name',
    'brand',
    'brand_cn',
    'model',
    'category',
    'price',
    'image_count',
    'image_urls',
    'params_json',
    'source_platform',
    'source_url',
  ];

  // 构建 CSV 内容
  const rows: string[] = [];

  // 添加表头
  rows.push(headers.join(','));

  // 添加数据行
  for (const product of products) {
    const row = [
      escapeCsvField(product.id),
      escapeCsvField(product.name),
      escapeCsvField(product.brand),
      escapeCsvField(product.brand_cn),
      escapeCsvField(product.model),
      escapeCsvField(product.category),
      escapeCsvField(product.price),
      escapeCsvField(product.images.length),
      escapeCsvField(product.images.join(' | ')),
      escapeCsvField(JSON.stringify(product.params)),
      escapeCsvField(product.source.platform),
      escapeCsvField(product.source.url),
    ];

    rows.push(row.join(','));
  }

  // 写入文件（带 BOM 头，支持 Excel 打开中文）
  const BOM = '﻿';
  const csvContent = BOM + rows.join('\n');
  await writeFile(filePath, csvContent, 'utf-8');

  console.log(`✅ CSV 导出完成: ${filePath}`);
  console.log(`   产品数量: ${products.length}`);

  return filePath;
}

// =====================================================
// 生成 CSV 统计
// =====================================================

export function generateCsvStats(products: Product[]): {
  total: number;
  withPrice: number;
  withImages: number;
  withParams: number;
  avgImagesPerProduct: number;
} {
  let withPrice = 0;
  let withImages = 0;
  let withParams = 0;
  let totalImages = 0;

  for (const product of products) {
    if (product.price) withPrice++;
    if (product.images.length > 0) {
      withImages++;
      totalImages += product.images.length;
    }
    if (Object.keys(product.params).length > 0) withParams++;
  }

  return {
    total: products.length,
    withPrice,
    withImages,
    withParams,
    avgImagesPerProduct: products.length > 0 ? totalImages / products.length : 0,
  };
}
