/**
 * 工具函数
 */

// =====================================================
// 延迟函数
// =====================================================
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =====================================================
// URL 验证（遵循 security-best-practices）
// =====================================================
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

// =====================================================
// 品牌名称验证
// =====================================================
export function isValidBrand(brand: string): boolean {
  return /^[a-z]+$/.test(brand);
}

// =====================================================
// 产品 ID 验证
// =====================================================
export function isValidProductId(productId: string): boolean {
  return /^\d+$/.test(productId);
}

// =====================================================
// 解码 HTML 实体
// =====================================================
export function decodeHtmlEntities(text: string): string {
  if (!text) return '';

  let decoded = text;

  // 解码 &#xxx; 格式的数字实体
  decoded = decoded.replace(/&#(\d+);/g, (_, num) => {
    return String.fromCharCode(parseInt(num, 10));
  });

  // 解码 &#xHH; 格式的十六进制实体
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });

  // 替换命名实体
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&bull;': '•',
    '&middot;': '·',
    '&nbsp;': ' ',
  };

  Object.entries(entities).forEach(([entity, char]) => {
    decoded = decoded.replace(new RegExp(entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), char);
  });

  return decoded;
}

// =====================================================
// 清理 HTML 标签
// =====================================================
export function stripHtmlTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]*>/g, '').trim());
}

// =====================================================
// 清理文本
// =====================================================
export function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();
}

// =====================================================
// 格式化数字
// =====================================================
export function parseNumber(value: string): number | null {
  const cleaned = value.replace(/[^\d.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// =====================================================
// 格式化价格
// =====================================================
export function parsePrice(value: string): number | null {
  const cleaned = value.replace(/[^\d.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// =====================================================
// 格式化持续时间
// =====================================================
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

// =====================================================
// 格式化文件大小
// =====================================================
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// =====================================================
// 批处理数组
// =====================================================
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// =====================================================
// 重试函数
// =====================================================
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  retryDelay: number
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) {
        throw error;
      }
      await sleep(Math.pow(2, i) * retryDelay);
    }
  }
  throw new Error('Max retries exceeded');
}
