/**
 * 爬虫主入口
 * 遵循: supabase-postgres-best-practices, native-data-fetching, security-best-practices
 */

import { config, validateConfig, printConfig, categories, getCategoryConfig } from './config';
import { PconlineClient, ApiError } from './pconline-client';
import { ImageDownloader } from './image-downloader';
import { ProgressReporter } from './progress';
import {
  testConnection,
  insertProduct,
  insertImage,
  closePool,
  countProducts,
  countProductsByBrand,
} from './db-writer';
import {
  loadCrawledIds,
  addCrawledIds,
  addFailedProduct,
  getRetryableProducts,
  clearState,
  getStateStats,
} from './resume';
import { Product } from './types';
import { sleep, formatDuration } from './utils';
import {
  logProductCrawled,
  logProductFailed,
  logError,
  logCrawlerComplete,
} from './logger';

// =====================================================
// 核心参数列表（只保留这些参数）
// =====================================================
const CORE_PARAMS = [
  '型号', '重量', '制冷剂', '压缩机', '总容积', '显示屏',
  '产品类别', '冷冻能力', '制冷方式', '包装尺寸', '外形尺寸',
  '按键方式', '控制方式', '机身颜色', '气候类型', '电源性能',
  '能耗等级', '运行噪音', '适用范围', '除霜功能', '面板类型',
  '冷冻室容积', '冷藏室容积', '额定耗电量'
];

// =====================================================
// 爬取单个类别
// =====================================================
async function crawlCategory(
  categoryId: string,
  client: PconlineClient,
  imageDownloader: ImageDownloader,
  crawledIds: Set<string>
): Promise<{ success: number; fail: number; skip: number }> {
  const categoryConfig = getCategoryConfig(categoryId);
  if (!categoryConfig) {
    console.error(`❌ 未知类别: ${categoryId}`);
    return { success: 0, fail: 0, skip: 0 };
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📦 开始爬取类别: ${categoryConfig.name} (${categoryId})`);
  console.log('='.repeat(60));

  const progress = new ProgressReporter();
  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  // 统计该类别的产品数量
  console.log('\n📊 统计产品数量...');
  let totalProducts = 0;

  for (const brand of categoryConfig.brands) {
    try {
      const list = await client.getProductList(brand, undefined, categoryId);
      const count = list.products.length;
      totalProducts += count;
      console.log(`  - ${brand}: ${count} 个产品`);
    } catch (error) {
      console.error(`  - ${brand}: 统计失败`);
    }
  }

  console.log(`\n📊 ${categoryConfig.name}总计: ${totalProducts} 个产品`);
  progress.setTotal(totalProducts);

  // 开始爬取
  console.log('\n🔄 开始爬取...');
  const startTime = Date.now();

  for (const brand of categoryConfig.brands) {
    console.log(`\n📦 处理品牌: ${brand}`);

    let cursor: string | undefined;
    let page = 1;

    do {
      try {
        // 获取产品列表
        const list = await client.getProductList(brand, cursor, categoryId);
        console.log(`  📄 第 ${page} 页: ${list.products.length} 个产品`);

        // 处理每个产品
        for (const item of list.products) {
          const productKey = `${categoryId}/${brand}/${item.id}`;

          // 检查是否已爬取（断点续爬）
          if (crawledIds.has(productKey)) {
            skipCount++;
            progress.increment();
            continue;
          }

          try {
            // 获取产品参数
            const rawParams = await client.getProductParams(brand, item.id, categoryId);

            // 只保留核心参数
            const params: Record<string, string> = {};
            for (const key of CORE_PARAMS) {
              if (rawParams[key]) {
                params[key] = rawParams[key];
              }
            }

            // 获取产品详情
            const detail = await client.getProductDetail(brand, item.id, categoryId);

            // 下载产品图片（下载前3张高清图）
            let imageId: number | undefined;
            const imagesToDownload = detail.images.slice(0, 3);
            for (const imgUrl of imagesToDownload) {
              const imageData = await imageDownloader.download(imgUrl);
              if (imageData) {
                const id = await insertImage(imageData);
                if (!imageId) {
                  imageId = id; // 第一张作为主图
                }
              }
            }

            // 构建产品对象
            const product: Product = {
              name: detail.name || item.name,
              brand,
              category: categoryId,
              model: params['型号'] || undefined,
              params,
              price: detail.price || undefined,
              rating: detail.rating || undefined,
              images: detail.images,
              sourceUrl: `https://product.pconline.com.cn/${categoryId}/${brand}/${item.id}.html`,
              sourcePlatform: 'pconline',
            };

            // 写入数据库
            await insertProduct(product, imageId);

            // 记录已爬取
            crawledIds.add(productKey);
            await addCrawledIds([productKey]);

            successCount++;
            logProductCrawled(brand, item.id, product.name);

          } catch (error) {
            failCount++;
            logProductFailed(brand, item.id, error as Error);

            // 记录失败产品
            await addFailedProduct({
              brand,
              productId: item.id,
              category: categoryId,
              error: (error as Error).message,
              retries: 0,
              lastAttempt: new Date(),
            });
          }

          progress.increment();
        }

        // 移动到下一页
        cursor = list.nextCursor;
        page++;

        // 页面间延迟
        if (cursor) {
          await sleep(1000);
        }

      } catch (error) {
        logError(error as Error, { brand, page, category: categoryId });
        console.error(`  ❌ 品牌 ${brand} 第 ${page} 页失败`);
        break;
      }
    } while (cursor);
  }

  // 完成报告
  const duration = (Date.now() - startTime) / 1000;
  progress.complete(successCount, failCount);

  console.log(`\n✅ ${categoryConfig.name}爬取完成: 成功 ${successCount}, 失败 ${failCount}, 跳过 ${skipCount}`);

  return { success: successCount, fail: failCount, skip: skipCount };
}

// =====================================================
// 主函数
// =====================================================
async function main() {
  console.log('🚀 家电数据爬虫启动');
  console.log('='.repeat(60));

  try {
    // 1. 验证配置
    validateConfig();
    printConfig();

    // 2. 测试数据库连接
    const connected = await testConnection();
    if (!connected) {
      console.error('❌ 数据库连接失败，请检查配置');
      process.exit(1);
    }
    console.log('✅ 数据库连接成功');

    // 3. 初始化客户端
    const client = new PconlineClient();
    const imageDownloader = new ImageDownloader(
      config.maxConcurrent,
      config.maxRetries,
      config.retryDelay
    );

    // 4. 加载已爬取的 ID（支持断点续爬）
    const crawledIds = await loadCrawledIds();
    console.log(`📋 已爬取 ${crawledIds.size} 个产品`);

    // 5. 爬取所有类别
    const startTime = Date.now();
    const results: Array<{ category: string; success: number; fail: number; skip: number }> = [];

    for (const category of categories) {
      const result = await crawlCategory(category.id, client, imageDownloader, crawledIds);
      results.push({ category: category.name, ...result });
    }

    // 6. 最终统计
    const duration = (Date.now() - startTime) / 1000;

    console.log('\n' + '='.repeat(60));
    console.log('🎉 全部类别爬取完成');
    console.log('='.repeat(60));

    console.log('\n📊 各类别统计:');
    let totalSuccess = 0;
    let totalFail = 0;
    let totalSkip = 0;

    for (const result of results) {
      console.log(`  - ${result.category}: 成功 ${result.success}, 失败 ${result.fail}, 跳过 ${result.skip}`);
      totalSuccess += result.success;
      totalFail += result.fail;
      totalSkip += result.skip;
    }

    console.log(`\n📈 总计:`);
    console.log(`  - 成功: ${totalSuccess} 个产品`);
    console.log(`  - 失败: ${totalFail} 个产品`);
    console.log(`  - 跳过: ${totalSkip} 个产品`);
    console.log(`  - 总用时: ${formatDuration(duration)}`);

    // 7. 数据库统计
    const dbCount = await countProducts();
    console.log(`\n💾 数据库总数: ${dbCount} 个产品`);

    const brandStats = await countProductsByBrand();
    console.log('\n📈 品牌统计:');
    brandStats.forEach(s => console.log(`  - ${s.brand}: ${s.count} 个产品`));

    console.log('\n✅ 全部完成!');

  } catch (error) {
    logError(error as Error, { context: '爬虫主流程失败' });
    console.error('❌ 爬虫失败:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

// =====================================================
// 重试失败产品
// =====================================================
async function retryFailed() {
  console.log('🔄 重试失败产品...');

  try {
    const retryable = await getRetryableProducts(config.maxRetries);
    console.log(`📋 找到 ${retryable.length} 个可重试的产品`);

    if (retryable.length === 0) {
      console.log('✅ 没有需要重试的产品');
      return;
    }

    const client = new PconlineClient();
    const imageDownloader = new ImageDownloader(
      config.maxConcurrent,
      config.maxRetries,
      config.retryDelay
    );

    let successCount = 0;
    let failCount = 0;

    for (const item of retryable) {
      try {
        // 获取产品参数
        const rawParams = await client.getProductParams(item.brand, item.productId);

        // 只保留核心参数
        const params: Record<string, string> = {};
        for (const key of CORE_PARAMS) {
          if (rawParams[key]) {
            params[key] = rawParams[key];
          }
        }

        // 获取产品详情
        const detail = await client.getProductDetail(item.brand, item.productId);

        // 下载产品图片
        let imageId: number | undefined;
        if (detail.images.length > 0) {
          const imageData = await imageDownloader.download(detail.images[0]);
          if (imageData) {
            imageId = await insertImage(imageData);
          }
        }

        // 构建产品对象
        const product: Product = {
          name: detail.name || `Unknown ${item.productId}`,
          brand: item.brand,
          model: params['型号'] || undefined,
          params,
          price: detail.price || undefined,
          rating: detail.rating || undefined,
          images: detail.images,
          sourceUrl: `https://product.pconline.com.cn/icebox/${item.brand}/${item.productId}.html`,
          sourcePlatform: 'pconline',
        };

        // 写入数据库
        await insertProduct(product, imageId);

        successCount++;
        console.log(`  ✅ ${item.brand}/${item.productId}`);

        // 延迟
        await sleep(1000);

      } catch (error) {
        failCount++;
        console.error(`  ❌ ${item.brand}/${item.productId}: ${(error as Error).message}`);
      }
    }

    console.log(`\n📊 重试完成: 成功 ${successCount}, 失败 ${failCount}`);

  } catch (error) {
    logError(error as Error, { context: '重试失败产品出错' });
    console.error('❌ 重试失败:', error);
  } finally {
    await closePool();
  }
}

// =====================================================
// 命令行参数处理
// =====================================================
const args = process.argv.slice(2);

if (args.includes('--retry')) {
  retryFailed().then(() => process.exit(0));
} else if (args.includes('--clear')) {
  clearState().then(() => {
    console.log('✅ 状态已清空');
    process.exit(0);
  });
} else if (args.includes('--stats')) {
  getStateStats().then(async (stats) => {
    console.log('📊 爬虫状态统计:');
    console.log(`  - 已爬取: ${stats.crawledCount} 个产品`);
    console.log(`  - 失败: ${stats.failedCount} 个产品`);

    const dbCount = await countProducts();
    console.log(`  - 数据库总数: ${dbCount} 个产品`);

    const brandStats = await countProductsByBrand();
    console.log('\n📈 品牌统计:');
    brandStats.forEach(s => console.log(`  - ${s.brand}: ${s.count} 个产品`));

    await closePool();
    process.exit(0);
  });
} else {
  // 正常爬取
  main().then(() => process.exit(0));
}
