/**
 * 本地图片存储（开发环境）
 * 文件落在桌面脚本目录 ~/Desktop/crawler_test/images-data/（不进项目仓库）
 * 对外 URL 为 /local-images/{filename}
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

/** 默认：桌面 crawler_test/images-data，可用 IMAGE_STAGING_DIR 覆盖 */
export const LOCAL_IMAGE_DIR = path.resolve(
  process.env.IMAGE_STAGING_DIR ||
    path.join(os.homedir(), 'Desktop', 'crawler_test', 'images-data')
);

export const LOCAL_IMAGE_URL_PREFIX = '/local-images';

export function ensureLocalImageDir(): string {
  fs.mkdirSync(LOCAL_IMAGE_DIR, { recursive: true });
  return LOCAL_IMAGE_DIR;
}

export function extFromMime(mime?: string | null): string {
  if (!mime) return '.jpg';
  if (mime.includes('png')) return '.png';
  if (mime.includes('webp')) return '.webp';
  if (mime.includes('gif')) return '.gif';
  return '.jpg';
}

export function mimeFromExt(ext: string): string {
  const m: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };
  return m[ext.toLowerCase()] || 'image/jpeg';
}

export function localImageUrl(filename: string): string {
  return `${LOCAL_IMAGE_URL_PREFIX}/${filename.replace(/^\/+/, '')}`;
}

export function isLocalImageUrl(url: string | null | undefined): boolean {
  return !!url && (url.startsWith(LOCAL_IMAGE_URL_PREFIX + '/') || url.startsWith('/local-images/'));
}

export function hasOssCredentials(): boolean {
  return !!(
    process.env.ALIYUN_ACCESS_KEY_ID ||
    process.env.OSS_ACCESS_KEY_ID ||
    process.env.ALIBABA_CLOUD_ACCESS_KEY_ID
  );
}

/** 本地优先：无 OSS Key 或 IMAGE_STORAGE=local */
export function useLocalImageStorage(): boolean {
  if (process.env.IMAGE_STORAGE === 'local') return true;
  if (process.env.IMAGE_STORAGE === 'oss') return false;
  return !hasOssCredentials();
}

export function saveBufferToLocal(
  buffer: Buffer,
  opts: { filename?: string; mimeType?: string } = {}
): { filePath: string; filename: string; url: string } {
  ensureLocalImageDir();
  const ext = opts.filename
    ? path.extname(opts.filename) || extFromMime(opts.mimeType)
    : extFromMime(opts.mimeType);
  const filename =
    opts.filename ||
    `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext.startsWith('.') ? ext : '.' + ext}`;
  const filePath = path.join(LOCAL_IMAGE_DIR, filename);
  fs.writeFileSync(filePath, buffer);
  return { filePath, filename, url: localImageUrl(filename) };
}

export async function downloadToLocal(
  sourceUrl: string,
  opts: { filename?: string; referer?: string } = {}
): Promise<{ filename: string; url: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(sourceUrl, {
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
    if (!mime.startsWith('image/')) mime = 'image/jpeg';
    const saved = saveBufferToLocal(buffer, {
      filename: opts.filename,
      mimeType: mime,
    });
    return { filename: saved.filename, url: saved.url };
  } finally {
    clearTimeout(timer);
  }
}

export function resolveLocalImagePath(urlPath: string): string | null {
  // /local-images/xxx.jpg → images-data/xxx.jpg
  const name = urlPath
    .replace(/^\/local-images\//, '')
    .replace(/^local-images\//, '')
    .replace(/\.\./g, '');
  if (!name) return null;
  const safe = name.split('/').filter((p) => p && p !== '..').join('/');
  const full = path.resolve(LOCAL_IMAGE_DIR, safe);
  if (!full.startsWith(LOCAL_IMAGE_DIR + path.sep) && full !== LOCAL_IMAGE_DIR) return null;
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return null;
  return full;
}
