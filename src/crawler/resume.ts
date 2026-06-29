/**
 * 断点续爬模块
 * 用于记录已爬取的产品 ID，支持中断后恢复
 */

import fs from 'fs/promises';
import path from 'path';
import { FailedProduct, CrawlerState } from './types';
import { logError } from './logger';

// =====================================================
// 状态文件路径
// =====================================================
const STATE_DIR = './crawler-state';
const CRAWLED_IDS_FILE = path.join(STATE_DIR, 'crawled-ids.json');
const FAILED_PRODUCTS_FILE = path.join(STATE_DIR, 'failed-products.json');

// =====================================================
// 确保状态目录存在
// =====================================================
async function ensureStateDir(): Promise<void> {
  try {
    await fs.access(STATE_DIR);
  } catch {
    await fs.mkdir(STATE_DIR, { recursive: true });
  }
}

// =====================================================
// 加载已爬取的 ID
// =====================================================
export async function loadCrawledIds(): Promise<Set<string>> {
  try {
    await ensureStateDir();
    const data = await fs.readFile(CRAWLED_IDS_FILE, 'utf-8');
    const ids = JSON.parse(data) as string[];
    return new Set(ids);
  } catch (error) {
    // 文件不存在或解析失败，返回空集合
    return new Set();
  }
}

// =====================================================
// 保存已爬取的 ID
// =====================================================
export async function saveCrawledIds(ids: Set<string>): Promise<void> {
  try {
    await ensureStateDir();
    const data = JSON.stringify([...ids]);
    await fs.writeFile(CRAWLED_IDS_FILE, data, 'utf-8');
  } catch (error) {
    logError(error as Error, { context: '保存已爬取 ID 失败' });
  }
}

// =====================================================
// 添加已爬取的 ID
// =====================================================
export async function addCrawledId(id: string): Promise<void> {
  const ids = await loadCrawledIds();
  ids.add(id);
  await saveCrawledIds(ids);
}

// =====================================================
// 批量添加已爬取的 ID
// =====================================================
export async function addCrawledIds(newIds: string[]): Promise<void> {
  const ids = await loadCrawledIds();
  newIds.forEach(id => ids.add(id));
  await saveCrawledIds(ids);
}

// =====================================================
// 检查是否已爬取
// =====================================================
export async function isCrawled(id: string): Promise<boolean> {
  const ids = await loadCrawledIds();
  return ids.has(id);
}

// =====================================================
// 加载失败产品列表
// =====================================================
export async function loadFailedProducts(): Promise<FailedProduct[]> {
  try {
    await ensureStateDir();
    const data = await fs.readFile(FAILED_PRODUCTS_FILE, 'utf-8');
    return JSON.parse(data) as FailedProduct[];
  } catch (error) {
    // 文件不存在或解析失败，返回空数组
    return [];
  }
}

// =====================================================
// 保存失败产品列表
// =====================================================
export async function saveFailedProducts(products: FailedProduct[]): Promise<void> {
  try {
    await ensureStateDir();
    const data = JSON.stringify(products, null, 2);
    await fs.writeFile(FAILED_PRODUCTS_FILE, data, 'utf-8');
  } catch (error) {
    logError(error as Error, { context: '保存失败产品列表失败' });
  }
}

// =====================================================
// 添加失败产品
// =====================================================
export async function addFailedProduct(product: FailedProduct): Promise<void> {
  const products = await loadFailedProducts();

  // 检查是否已存在
  const existingIndex = products.findIndex(
    p => p.brand === product.brand && p.productId === product.productId
  );

  if (existingIndex >= 0) {
    // 更新重试次数
    products[existingIndex].retries = product.retries;
    products[existingIndex].lastAttempt = product.lastAttempt;
    products[existingIndex].error = product.error;
  } else {
    // 添加新的失败产品
    products.push(product);
  }

  await saveFailedProducts(products);
}

// =====================================================
// 移除失败产品（重试成功后）
// =====================================================
export async function removeFailedProduct(
  brand: string,
  productId: string
): Promise<void> {
  const products = await loadFailedProducts();
  const filtered = products.filter(
    p => !(p.brand === brand && p.productId === productId)
  );
  await saveFailedProducts(filtered);
}

// =====================================================
// 清空状态
// =====================================================
export async function clearState(): Promise<void> {
  try {
    await ensureStateDir();
    await fs.unlink(CRAWLED_IDS_FILE).catch(() => {});
    await fs.unlink(FAILED_PRODUCTS_FILE).catch(() => {});
  } catch (error) {
    logError(error as Error, { context: '清空状态失败' });
  }
}

// =====================================================
// 获取状态统计
// =====================================================
export async function getStateStats(): Promise<{
  crawledCount: number;
  failedCount: number;
}> {
  const crawledIds = await loadCrawledIds();
  const failedProducts = await loadFailedProducts();

  return {
    crawledCount: crawledIds.size,
    failedCount: failedProducts.length,
  };
}

// =====================================================
// 重试失败产品
// =====================================================
export async function getRetryableProducts(
  maxRetries: number = 3
): Promise<FailedProduct[]> {
  const products = await loadFailedProducts();
  return products.filter(p => p.retries < maxRetries);
}
