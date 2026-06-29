/**
 * 图片下载测试
 */

import { PconlineClient } from './pconline-client';
import { ImageDownloader } from './image-downloader';

async function testImageDownload() {
  console.log('🖼️ 测试图片下载...\n');

  const client = new PconlineClient();
  const downloader = new ImageDownloader(1, 2, 1000);

  // 获取产品图片
  console.log('  获取海尔产品图片...');
  const detail = await client.getProductDetail('haier', '2753199');
  console.log(`  找到 ${detail.images.length} 张图片`);

  if (detail.images.length > 0) {
    const imageUrl = detail.images[0];
    console.log(`  下载图片: ${imageUrl.substring(0, 60)}...`);

    const imageData = await downloader.download(imageUrl);
    if (imageData) {
      console.log(`  ✅ 下载成功`);
      console.log(`     MIME 类型: ${imageData.mimeType}`);
      console.log(`     文件大小: ${(imageData.fileSize / 1024).toFixed(1)} KB`);
      console.log(`     图片尺寸: ${imageData.width || '未知'} x ${imageData.height || '未知'}`);
    } else {
      console.log('  ❌ 下载失败');
    }
  }

  console.log('\n✅ 图片下载测试完成!');
}

testImageDownload().catch(console.error);
