/**
 * 测试图片 API
 * 运行: npx tsx src/db/test-image-api.ts
 */

const BASE_URL = 'http://localhost:3000';

async function testDownloadImage() {
  console.log('🧪 测试: 从 URL 下载图片\n');

  const testUrl = 'https://img.pconline.com.cn/images/upload/upi/1101/2024/01/01/test.jpg';

  try {
    const response = await fetch(`${BASE_URL}/api/image/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: testUrl,
        product_id: 1
      })
    });

    const result = await response.json();
    console.log('响应:', JSON.stringify(result, null, 2));

    if (result.code === 0) {
      console.log('✅ 下载接口正常\n');
      return result.data.id;
    } else {
      console.log('⚠️ 接口返回错误:', result.message, '\n');
      return null;
    }

  } catch (error) {
    console.log('❌ 请求失败:', (error as Error).message, '\n');
    return null;
  }
}

async function testGetImage(imageId: number) {
  console.log(`🧪 测试: 读取图片 (ID: ${imageId})\n`);

  try {
    const response = await fetch(`${BASE_URL}/api/image/${imageId}`);

    if (response.ok) {
      const contentType = response.headers.get('Content-Type');
      const contentLength = response.headers.get('Content-Length');
      console.log(`✅ 图片读取成功`);
      console.log(`   类型: ${contentType}`);
      console.log(`   大小: ${contentLength} bytes\n`);
      return true;
    } else {
      const error = await response.json();
      console.log('❌ 读取失败:', error, '\n');
      return false;
    }

  } catch (error) {
    console.log('❌ 请求失败:', (error as Error).message, '\n');
    return false;
  }
}

async function testGetProductImages(productId: number) {
  console.log(`🧪 测试: 获取产品图片列表 (产品ID: ${productId})\n`);

  try {
    const response = await fetch(`${BASE_URL}/api/image/product/${productId}`);
    const result = await response.json();

    console.log('响应:', JSON.stringify(result, null, 2));

    if (result.code === 0) {
      console.log(`✅ 获取成功，共 ${result.data.length} 张图片\n`);
      return true;
    } else {
      console.log('❌ 获取失败\n');
      return false;
    }

  } catch (error) {
    console.log('❌ 请求失败:', (error as Error).message, '\n');
    return false;
  }
}

async function testDetailApi(productId: number) {
  console.log(`🧪 测试: 详情接口图片字段 (产品ID: ${productId})\n`);

  try {
    const response = await fetch(`${BASE_URL}/api/detail?id=${productId}`);
    const result = await response.json();

    if (result.code === 0) {
      const { images } = result.data;
      console.log(`✅ 详情接口正常`);
      console.log(`   图片数量: ${images?.length || 0}`);
      if (images && images.length > 0) {
        console.log(`   第一张图片: ${images[0].substring(0, 50)}...`);
      }
      console.log('');
      return true;
    } else {
      console.log('❌ 获取失败:', result.message, '\n');
      return false;
    }

  } catch (error) {
    console.log('❌ 请求失败:', (error as Error).message, '\n');
    return false;
  }
}

async function main() {
  console.log('=' .repeat(60));
  console.log('🖼️  图片 API 测试');
  console.log('=' .repeat(60) + '\n');

  // 测试下载
  const imageId = await testDownloadImage();

  if (imageId) {
    // 测试读取
    await testGetImage(imageId);
  }

  // 测试产品图片列表
  await testGetProductImages(1);

  // 测试详情接口
  await testDetailApi(1);

  console.log('=' .repeat(60));
  console.log('✨ 测试完成');
  console.log('=' .repeat(60));
}

main().catch(console.error);
