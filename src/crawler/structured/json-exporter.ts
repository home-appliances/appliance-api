/**
 * JSON 导出模块
 * 功能：将清洗后的数据导出为 products.json
 */

import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Product } from './data-cleaner';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// =====================================================
// 类型定义
// =====================================================

export interface ExportMetadata {
  source: string;
  crawl_time: string;
  total_count: number;
  categories: string[];
  platforms: string[];
}

export interface ExportData {
  metadata: ExportMetadata;
  products: Product[];
}

// =====================================================
// JSON 导出函数
// =====================================================

export async function exportToJson(
  products: Product[],
  outputPath?: string
): Promise<string> {
  // 默认输出路径
  const dataDir = join(__dirname, '../../../data');
  const filePath = outputPath || join(dataDir, 'products.json');

  // 确保目录存在
  await mkdir(dirname(filePath), { recursive: true });

  // 统计信息
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
  const platforms = [...new Set(products.map(p => p.source.platform))];

  // 构建导出数据
  const exportData: ExportData = {
    metadata: {
      source: platforms.join(' + '),
      crawl_time: new Date().toISOString(),
      total_count: products.length,
      categories,
      platforms,
    },
    products,
  };

  // 写入文件
  const jsonContent = JSON.stringify(exportData, null, 2);
  await writeFile(filePath, jsonContent, 'utf-8');

  console.log(`✅ JSON 导出完成: ${filePath}`);
  console.log(`   产品数量: ${products.length}`);
  console.log(`   分类: ${categories.join(', ')}`);
  console.log(`   数据源: ${platforms.join(', ')}`);

  return filePath;
}

// =====================================================
// 生成 JSON 摘要
// =====================================================

export function generateSummary(products: Product[]): string {
  const total = products.length;
  const byCategory: Record<string, number> = {};
  const byPlatform: Record<string, number> = {};
  const byBrand: Record<string, number> = {};

  for (const product of products) {
    // 按分类统计
    const category = product.category || 'unknown';
    byCategory[category] = (byCategory[category] || 0) + 1;

    // 按平台统计
    const platform = product.source.platform || 'unknown';
    byPlatform[platform] = (byPlatform[platform] || 0) + 1;

    // 按品牌统计
    const brand = product.brand || 'unknown';
    byBrand[brand] = (byBrand[brand] || 0) + 1;
  }

  // 排序品牌（取前10）
  const topBrands = Object.entries(byBrand)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  let summary = `\n📊 数据摘要\n`;
  summary += `${'='.repeat(40)}\n`;
  summary += `总产品数: ${total}\n\n`;

  summary += `按分类:\n`;
  for (const [cat, count] of Object.entries(byCategory)) {
    summary += `  ${cat}: ${count}\n`;
  }

  summary += `\n按平台:\n`;
  for (const [platform, count] of Object.entries(byPlatform)) {
    summary += `  ${platform}: ${count}\n`;
  }

  summary += `\nTop 10 品牌:\n`;
  for (const [brand, count] of topBrands) {
    summary += `  ${brand}: ${count}\n`;
  }

  summary += `${'='.repeat(40)}\n`;

  return summary;
}
