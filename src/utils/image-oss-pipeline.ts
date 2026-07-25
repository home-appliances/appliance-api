/**
 * 图片流水线：源 URL / Buffer → 桌面 images-data 中转 → OSS → CDN URL
 * 禁止把图片二进制写入 PostgreSQL。
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import { uploadImage, validateImageFile } from './oss.js';

export const IMAGE_STAGING_DIR = path.resolve(
  process.env.IMAGE_STAGING_DIR ||
    path.join(os.homedir(), 'Desktop', 'crawler_test', 'images-data')
);

const CDN_HOSTS = ['static.cheapgo.top', 'cheapgo-assets.oss-cn-shenzhen.aliyuncs.com'];

export function isOssCdnUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  if (url.startsWith('/api/image')) return false;
  try {
    const u = new URL(url);
    return CDN_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith('.' + h));
  } catch {
    return /static\.cheapgo\.top|cheapgo-assets\.oss/.test(url);
  }
}

export function ensureStagingDir(): string {
  fs.mkdirSync(IMAGE_STAGING_DIR, { recursive: true });
  return IMAGE_STAGING_DIR;
}

function extFromMime(mime: string): string {
  if (mime.includes('png')) return '.png';
  if (mime.includes('webp')) return '.webp';
  if (mime.includes('gif')) return '.gif';
  return '.jpg';
}

function mimeFromExt(ext: string): string {
  const m: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };
  return m[ext.toLowerCase()] || 'image/jpeg';
}

function guessExt(url: string, mime?: string): string {
  if (mime) return extFromMime(mime);
  try {
    const p = new URL(url).pathname.toLowerCase();
    const ext = path.extname(p);
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) return ext;
  } catch {
    /* ignore */
  }
  return '.jpg';
}

/** 内存缓存：同源 URL 只上传一次（单进程迁移/导入用） */
const urlToOssCache = new Map<string, string>();

export function rememberOssUrl(sourceKey: string, ossUrl: string): void {
  urlToOssCache.set(sourceKey, ossUrl);
}

export function getCachedOssUrl(sourceKey: string): string | undefined {
  return urlToOssCache.get(sourceKey);
}

/**
 * Buffer → 本地中转文件 → OSS CDN URL
 */
export async function uploadBufferViaStaging(
  buffer: Buffer,
  opts: { originalName?: string; mimeType?: string; folder?: string; cacheKey?: string } = {}
): Promise<string> {
  if (opts.cacheKey) {
    const hit = urlToOssCache.get(opts.cacheKey);
    if (hit) return hit;
  }

  const mime = opts.mimeType || 'image/jpeg';
  const ext = guessExt(opts.originalName || '', mime);
  const originalName = opts.originalName?.includes('.')
    ? opts.originalName
    : `image${ext}`;

  const validation = validateImageFile({
    size: buffer.length,
    originalName,
    mimeType: mime.startsWith('image/') ? mime : undefined,
  });
  if (!validation.valid) {
    throw new Error(validation.error || '图片校验失败');
  }

  ensureStagingDir();
  const localName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
  const localPath = path.join(IMAGE_STAGING_DIR, localName);
  fs.writeFileSync(localPath, buffer);

  try {
    const ossUrl = await uploadImage(buffer, originalName, opts.folder || 'products');
    if (opts.cacheKey) urlToOssCache.set(opts.cacheKey, ossUrl);
    return ossUrl;
  } finally {
    try {
      fs.unlinkSync(localPath);
    } catch {
      /* 中转文件清不掉不影响主流程 */
    }
  }
}

/**
 * 远程/任意 URL →（若已是 OSS 则直返）下载到中转目录 → OSS
 */
export async function ensureRemoteImageOnOss(
  sourceUrl: string,
  opts: { referer?: string; folder?: string } = {}
): Promise<string> {
  const url = (sourceUrl || '').trim();
  if (!url) throw new Error('空图片 URL');
  if (isOssCdnUrl(url)) return url;

  const cached = urlToOssCache.get(url);
  if (cached) return cached;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: opts.referer || 'https://detail.zol.com.cn/',
        Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 100) throw new Error(`图片过小: ${buffer.length}`);

    let mime = (response.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
    if (!mime.startsWith('image/')) {
      mime = mimeFromExt(guessExt(url));
    }

    return await uploadBufferViaStaging(buffer, {
      originalName: `remote${guessExt(url, mime)}`,
      mimeType: mime,
      folder: opts.folder || 'products',
      cacheKey: url,
    });
  } finally {
    clearTimeout(timer);
  }
}
