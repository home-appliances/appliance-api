/**
 * 日志系统
 * 遵循 security-best-practices: 不记录敏感信息
 * 遵循 native-data-fetching: 结构化日志
 */

import winston from 'winston';
import { config } from './config';

// =====================================================
// 日志格式
// =====================================================
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// =====================================================
// 控制台格式
// =====================================================
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
    return `${timestamp} ${level}: ${message} ${metaStr}`;
  })
);

// =====================================================
// 创建 Logger
// =====================================================
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    // 错误日志
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // 所有日志
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // 控制台输出
    new winston.transports.Console({
      format: consoleFormat,
    }),
  ],
});

// =====================================================
// 安全的日志方法（不记录敏感信息）
// =====================================================

/**
 * 记录数据库连接（不记录密码）
 */
export function logDatabaseConnection(): void {
  logger.info('数据库连接成功', {
    host: config.dbHost,
    port: config.dbPort,
    database: config.dbName,
    // ✅ 不记录密码
  });
}

/**
 * 记录请求
 */
export function logRequest(url: string): void {
  logger.info('发起请求', { url });
}

/**
 * 记录请求成功
 */
export function logRequestSuccess(url: string, duration: number): void {
  logger.info('请求成功', { url, duration: `${duration}ms` });
}

/**
 * 记录请求失败
 */
export function logRequestFailed(url: string, error: Error, attempt: number): void {
  logger.warn('请求失败', {
    url,
    error: error.message,
    attempt,
  });
}

/**
 * 记录产品爬取成功
 */
export function logProductCrawled(brand: string, productId: string, name: string): void {
  logger.info('产品爬取成功', { brand, productId, name });
}

/**
 * 记录产品爬取失败
 */
export function logProductFailed(brand: string, productId: string, error: Error): void {
  logger.error('产品爬取失败', {
    brand,
    productId,
    error: error.message,
  });
}

/**
 * 记录数据库写入成功
 */
export function logDatabaseWrite(table: string, count: number): void {
  logger.info('数据库写入成功', { table, count });
}

/**
 * 记录数据库写入失败
 */
export function logDatabaseWriteFailed(table: string, error: Error): void {
  logger.error('数据库写入失败', { table, error: error.message });
}

/**
 * 记录爬虫完成
 */
export function logCrawlerComplete(
  totalProducts: number,
  successCount: number,
  failCount: number,
  duration: number
): void {
  logger.info('爬虫完成', {
    totalProducts,
    successCount,
    failCount,
    duration: `${duration}s`,
    successRate: `${((successCount / totalProducts) * 100).toFixed(1)}%`,
  });
}

/**
 * 记录错误（通用）
 */
export function logError(error: Error, context?: Record<string, any>): void {
  logger.error('错误发生', {
    message: error.message,
    stack: error.stack,
    ...context,
  });
}
