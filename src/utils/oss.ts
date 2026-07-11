/**
 * 阿里云 OSS 上传工具
 */

import OSS from 'ali-oss';
import path from 'path';
import crypto from 'crypto';

// CDN 域名（图片走 CDN 加速）
const CDN_DOMAIN = process.env.CDN_DOMAIN || 'https://static.cheapgo.top';

// OSS 客户端懒加载
let _ossClient: OSS | null = null;

function getOssClient(): OSS {
  if (!_ossClient) {
    const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
    const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;

    if (!accessKeyId || !accessKeySecret) {
      throw new Error('OSS 配置缺失：请设置 ALIYUN_ACCESS_KEY_ID 和 ALIYUN_ACCESS_KEY_SECRET 环境变量');
    }

    _ossClient = new OSS({
      region: 'oss-cn-shenzhen',
      accessKeyId,
      accessKeySecret,
      bucket: 'cheapgo-assets',
      endpoint: 'oss-cn-shenzhen.aliyuncs.com',
      secure: true,
    });
  }
  return _ossClient;
}

/**
 * 上传图片到 OSS
 * @param file 文件 Buffer
 * @param originalName 原始文件名
 * @param folder 存储目录（如 'products'）
 * @returns 图片访问 URL
 */
export async function uploadImage(
  file: Buffer,
  originalName: string,
  folder: string = 'products'
): Promise<string> {
  const client = getOssClient();

  // 生成唯一文件名
  const ext = path.extname(originalName).toLowerCase() || '.jpg';
  const fileName = `${folder}/${crypto.randomUUID()}${ext}`;

  // 上传文件
  await client.put(fileName, file, {
    headers: {
      'Content-Type': getContentType(ext),
      'Cache-Control': 'max-age=31536000', // 缓存1年
    },
  });

  // 返回 CDN 域名的 URL
  return `${CDN_DOMAIN}/${fileName}`;
}

/**
 * 删除 OSS 文件
 * @param url 文件 URL
 */
export async function deleteImage(url: string): Promise<void> {
  try {
    const client = getOssClient();
    // 从 URL 提取文件名
    const fileName = url.replace(CDN_DOMAIN + '/', '');
    await client.delete(fileName);
  } catch (error) {
    console.error('删除 OSS 文件失败:', error);
  }
}

/**
 * 批量上传图片
 * @param files 文件数组
 * @param folder 存储目录
 * @returns URL 数组
 */
export async function uploadImages(
  files: Array<{ buffer: Buffer; originalName: string }>,
  folder: string = 'products'
): Promise<string[]> {
  const urls: string[] = [];

  for (const file of files) {
    const url = await uploadImage(file.buffer, file.originalName, folder);
    urls.push(url);
  }

  return urls;
}

/**
 * 根据文件扩展名获取 Content-Type
 */
function getContentType(ext: string): string {
  const types: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
  };
  return types[ext] || 'application/octet-stream';
}

/**
 * 验证图片文件
 * @param file 文件信息
 * @returns 是否有效
 */
export function validateImageFile(file: { size: number; originalName: string }): {
  valid: boolean;
  error?: string;
} {
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

  if (file.size > MAX_SIZE) {
    return { valid: false, error: '图片大小不能超过 5MB' };
  }

  const ext = path.extname(file.originalName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { valid: false, error: '只支持 JPG、PNG、GIF、WebP 格式' };
  }

  return { valid: true };
}
