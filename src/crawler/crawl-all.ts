/**
 * 综合爬虫入口 - 爬取所有数据源并融合
 * 使用方法: npm run crawl:all
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

const execAsync = promisify(exec);

// 配置
const CONFIG = {
  // 是否执行数据融合
  runMerge: true,
  // 是否爬取 ZOL
  crawlZol: true,
  // 是否爬取 PConline Kitchen
  crawlKitchen: true,
};

/**
 * 执行命令
 */
async function runCommand(cmd: string, label: string): Promise<boolean> {
  console.log(`\n🔄 ${label}...`);
  try {
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: path.join(__dirname, '../..'),
      timeout: 3600000, // 1小时超时
    });

    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);

    console.log(`✅ ${label} 完成`);
    return true;
  } catch (error: any) {
    console.error(`❌ ${label} 失败:`, error.message);
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 综合爬虫启动\n');
  console.log('配置:', JSON.stringify(CONFIG, null, 2));
  console.log('');

  const startTime = Date.now();
  let successCount = 0;
  let failCount = 0;

  try {
    // 1. 爬取 ZOL 空调
    if (CONFIG.crawlZol) {
      const zolSuccess = await runCommand('npm run crawl:zol', '爬取 ZOL 空调数据');
      if (zolSuccess) successCount++;
      else failCount++;
    }

    // 2. 爬取 PConline 厨卫
    if (CONFIG.crawlKitchen) {
      const kitchenSuccess = await runCommand('npm run crawl:kitchen', '爬取 PConline 厨卫数据');
      if (kitchenSuccess) successCount++;
      else failCount++;
    }

    // 3. 数据融合
    if (CONFIG.runMerge) {
      const mergeSuccess = await runCommand('npm run merge', '数据融合与去重');
      if (mergeSuccess) successCount++;
      else failCount++;
    }

    // 4. 统计结果
    const duration = Math.round((Date.now() - startTime) / 1000);

    console.log('\n' + '='.repeat(50));
    console.log('📊 综合爬虫完成');
    console.log('='.repeat(50));
    console.log(`   耗时: ${Math.floor(duration / 60)}分${duration % 60}秒`);
    console.log(`   成功: ${successCount}`);
    console.log(`   失败: ${failCount}`);
    console.log('='.repeat(50));

    if (failCount > 0) {
      console.log('\n⚠️ 部分任务失败，请检查日志');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ 综合爬虫异常:', error);
    process.exit(1);
  }
}

main();
