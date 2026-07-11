/**
 * 进度报告
 * 用于实时显示爬取进度
 */

import { ProgressReport } from './types';
import { formatDuration } from './utils';

// =====================================================
// 进度报告器
// =====================================================
export class ProgressReporter {
  private total: number = 0;
  private current: number = 0;
  private startTime: Date = new Date();
  private lastReportTime: Date = new Date();
  private reportInterval: number = 5000; // 5 秒报告一次

  /**
   * 设置总数
   */
  setTotal(total: number) {
    this.total = total;
    this.startTime = new Date();
    this.lastReportTime = new Date();
  }

  /**
   * 增加进度
   */
  increment(count: number = 1) {
    this.current += count;
    this.reportIfNeeded();
  }

  /**
   * 按需报告
   */
  private reportIfNeeded() {
    const now = new Date();
    const elapsed = now.getTime() - this.lastReportTime.getTime();

    if (elapsed >= this.reportInterval) {
      this.report();
      this.lastReportTime = now;
    }
  }

  /**
   * 立即报告
   */
  report(): ProgressReport {
    const now = new Date();
    const elapsed = (now.getTime() - this.startTime.getTime()) / 1000;
    const rate = this.current / elapsed;
    const remaining = (this.total - this.current) / rate;

    const report: ProgressReport = {
      total: this.total,
      current: this.current,
      percentage: this.total > 0 ? (this.current / this.total) * 100 : 0,
      rate,
      remaining,
      elapsed,
    };

    this.printReport(report);

    return report;
  }

  /**
   * 打印报告
   */
  private printReport(report: ProgressReport) {
    const percentage = report.percentage.toFixed(1);
    const barLength = 30;
    const filledLength = Math.max(0, Math.min(barLength, Math.round((report.percentage / 100) * barLength)));
    const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);

    console.log('\n' + '='.repeat(60));
    console.log(`📊 爬取进度`);
    console.log('='.repeat(60));
    console.log(`进度: [${bar}] ${percentage}%`);
    console.log(`完成: ${report.current}/${report.total}`);
    console.log(`速度: ${report.rate.toFixed(1)} 产品/秒`);
    console.log(`剩余时间: ${formatDuration(report.remaining)}`);
    console.log(`已用时间: ${formatDuration(report.elapsed)}`);
    console.log('='.repeat(60) + '\n');
  }

  /**
   * 完成报告
   */
  complete(successCount: number, failCount: number) {
    const elapsed = (Date.now() - this.startTime.getTime()) / 1000;

    console.log('\n' + '='.repeat(60));
    console.log(`🎉 爬取完成`);
    console.log('='.repeat(60));
    console.log(`总数: ${this.total}`);
    console.log(`成功: ${successCount}`);
    console.log(`失败: ${failCount}`);
    console.log(`成功率: ${((successCount / this.total) * 100).toFixed(1)}%`);
    console.log(`总用时: ${formatDuration(elapsed)}`);
    console.log('='.repeat(60) + '\n');
  }

  /**
   * 获取当前进度
   */
  getProgress(): ProgressReport {
    const now = new Date();
    const elapsed = (now.getTime() - this.startTime.getTime()) / 1000;
    const rate = this.current / elapsed;
    const remaining = (this.total - this.current) / rate;

    return {
      total: this.total,
      current: this.current,
      percentage: this.total > 0 ? (this.current / this.total) * 100 : 0,
      rate,
      remaining,
      elapsed,
    };
  }
}
