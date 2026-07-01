/**
 * 图片下载器
 * 遵循 native-data-fetching: 使用 fetch、错误处理
 * 遵循 security-best-practices: URL 验证、错误处理
 */

import { ImageData } from './types';
import { isValidUrl, sleep } from './utils';
import { logRequest, logRequestSuccess, logRequestFailed, logError } from './logger';

// =====================================================
// 限流器
// =====================================================
class RateLimiter {
  private queue: Array<() => void> = [];
  private running = 0;

  constructor(private maxPerSecond: number) {}

  async acquire() {
    if (this.running >= this.maxPerSecond) {
      await new Promise(resolve => this.queue.push(resolve));
    }
    this.running++;
  }

  release() {
    this.running--;
    if (this.queue.length > 0) {
      this.queue.shift()!();
    }
  }
}

// =====================================================
// 图片下载器
// =====================================================
export class ImageDownloader {
  private limiter: RateLimiter;
  private maxRetries: number;
  private retryDelay: number;

  constructor(
    maxConcurrent: number = 3,
    maxRetries: number = 3,
    retryDelay: number = 1000
  ) {
    this.limiter = new RateLimiter(maxConcurrent);
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
  }

  // =====================================================
  // 下载图片
  // =====================================================
  async download(imageUrl: string): Promise<ImageData | null> {
    // 验证 URL（遵循 security-best-practices）
    if (!isValidUrl(imageUrl)) {
      logError(new Error(`无效的图片 URL: ${imageUrl}`));
      return null;
    }

    for (let i = 0; i < this.maxRetries; i++) {
      await this.limiter.acquire();
      const startTime = Date.now();

      try {
        logRequest(imageUrl);

        const response = await fetch(imageUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
            Referer: 'https://product.pconline.com.cn/',
          },
          signal: AbortSignal.timeout(30000), // 30 秒超时
        });

        const duration = Date.now() - startTime;

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        // 获取二进制数据
        const buffer = await response.arrayBuffer();
        const data = Buffer.from(buffer);

        // 获取 MIME 类型
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const mimeType = this.normalizeMimeType(contentType);

        // 获取图片尺寸（可选）
        const { width, height } = await this.getImageDimensions(data, mimeType);

        logRequestSuccess(imageUrl, duration);

        return {
          data,
          mimeType,
          fileSize: data.length,
          width,
          height,
          sourceUrl: imageUrl,
        };
      } catch (error) {
        if (i === this.maxRetries - 1) {
          logRequestFailed(imageUrl, error as Error, i + 1);
          return null;
        }

        // 指数退避
        const delay = Math.pow(2, i) * this.retryDelay;
        await sleep(delay);
      } finally {
        this.limiter.release();
      }
    }

    return null;
  }

  // =====================================================
  // 批量下载图片
  // =====================================================
  async downloadBatch(
    imageUrls: string[]
  ): Promise<Map<string, ImageData | null>> {
    const results = new Map<string, ImageData | null>();

    // 串行下载（避免并发过高）
    for (const url of imageUrls) {
      const imageData = await this.download(url);
      results.set(url, imageData);
    }

    return results;
  }

  // =====================================================
  // 规范化 MIME 类型
  // =====================================================
  private normalizeMimeType(contentType: string): string {
    const mimeMap: Record<string, string> = {
      'image/jpeg': 'image/jpeg',
      'image/jpg': 'image/jpeg',
      'image/png': 'image/png',
      'image/gif': 'image/gif',
      'image/webp': 'image/webp',
      'image/bmp': 'image/bmp',
      'image/svg+xml': 'image/svg+xml',
    };

    const baseType = contentType.split(';')[0].trim().toLowerCase();
    return mimeMap[baseType] || 'image/jpeg';
  }

  // =====================================================
  // 获取图片尺寸（简单实现）
  // =====================================================
  private async getImageDimensions(
    data: Buffer,
    mimeType: string
  ): Promise<{ width?: number; height?: number }> {
    try {
      // JPEG
      if (mimeType === 'image/jpeg') {
        return this.getJpegDimensions(data);
      }

      // PNG
      if (mimeType === 'image/png') {
        return this.getPngDimensions(data);
      }

      // 其他格式暂不支持
      return {};
    } catch {
      return {};
    }
  }

  // =====================================================
  // 获取 JPEG 尺寸
  // =====================================================
  private getJpegDimensions(
    data: Buffer
  ): { width?: number; height?: number } {
    try {
      let offset = 2; // 跳过 SOI 标记

      while (offset < data.length - 1) {
        if (data[offset] !== 0xff) break;

        const marker = data[offset + 1];

        // SOF0 或 SOF2 标记
        if (marker === 0xc0 || marker === 0xc2) {
          const height = data.readUInt16BE(offset + 5);
          const width = data.readUInt16BE(offset + 7);
          return { width, height };
        }

        // 跳过其他段
        const segmentLength = data.readUInt16BE(offset + 2);
        offset += 2 + segmentLength;
      }

      return {};
    } catch {
      return {};
    }
  }

  // =====================================================
  // 获取 PNG 尺寸
  // =====================================================
  private getPngDimensions(
    data: Buffer
  ): { width?: number; height?: number } {
    try {
      // PNG 文件头：8 字节签名 + 4 字节长度 + 4 字节 "IHDR"
      if (data.length < 24) return {};

      const width = data.readUInt32BE(16);
      const height = data.readUInt32BE(20);

      return { width, height };
    } catch {
      return {};
    }
  }

  // =====================================================
  // 检查是否是有效图片
  // =====================================================
  isValidImage(data: Buffer): boolean {
    if (data.length < 8) return false;

    // JPEG 检查
    if (data[0] === 0xff && data[1] === 0xd8) return true;

    // PNG 检查
    if (
      data[0] === 0x89 &&
      data[1] === 0x50 &&
      data[2] === 0x4e &&
      data[3] === 0x47
    ) {
      return true;
    }

    // GIF 检查
    if (
      data[0] === 0x47 &&
      data[1] === 0x49 &&
      data[2] === 0x46 &&
      data[3] === 0x38
    ) {
      return true;
    }

    // WebP 检查
    if (
      data[0] === 0x52 &&
      data[1] === 0x49 &&
      data[2] === 0x46 &&
      data[3] === 0x46 &&
      data[8] === 0x57 &&
      data[9] === 0x45 &&
      data[10] === 0x42 &&
      data[11] === 0x50
    ) {
      return true;
    }

    return false;
  }
}
