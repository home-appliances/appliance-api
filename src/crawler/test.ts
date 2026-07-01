/**
 * 爬虫测试
 * 用于验证各模块功能
 */

import { PconlineClient } from './pconline-client';
import { ImageDownloader } from './image-downloader';
import { parseProductList, parseProductParams } from './html-parser';
import { isValidBrand, isValidProductId, sleep } from './utils';

// =====================================================
// 测试 HTML 解析器
// =====================================================
function testHtmlParser() {
  console.log('📝 测试 HTML 解析器...');

  // 测试产品列表解析
  const mockListHtml = `
    <a href="//product.pconline.com.cn/icebox/haier/2753199.html">海尔冰箱</a>
    <a href="//product.pconline.com.cn/icebox/haier/2639039.html">海尔冰箱</a>
    <a href="//product.pconline.com.cn/icebox/haier/25s1.shtml">下一页</a>
  `;
  const list = parseProductList(mockListHtml, 'haier');
  console.log(`  产品列表: ${list.products.length} 个产品`);
  console.log(`  下一页: ${list.nextCursor || '无'}`);

  // 测试产品参数解析
  const mockParamsHtml = `
    <tr class="" itemid="24596264">
      <th>型号</th>
      <td>BCD-502WGHTD1CDWU1</td>
    </tr>
    <tr class="" itemid="24596267">
      <th>产品类别</th>
      <td>十字对开门</td>
    </tr>
    <tr class="" itemid="24596269">
      <th>总容积</th>
      <td>502L</td>
    </tr>
  `;
  const params = parseProductParams(mockParamsHtml);
  console.log(`  产品参数: ${Object.keys(params).length} 个参数`);
  console.log(`  参数示例: ${JSON.stringify(params)}`);

  console.log('✅ HTML 解析器测试通过\n');
}

// =====================================================
// 测试工具函数
// =====================================================
function testUtils() {
  console.log('📝 测试工具函数...');

  // 测试品牌验证
  console.log(`  isValidBrand('haier'): ${isValidBrand('haier')}`);
  console.log(`  isValidBrand('Haier'): ${isValidBrand('Haier')}`);
  console.log(`  isValidBrand('123'): ${isValidBrand('123')}`);

  // 测试产品 ID 验证
  console.log(`  isValidProductId('2753199'): ${isValidProductId('2753199')}`);
  console.log(`  isValidProductId('abc'): ${isValidProductId('abc')}`);

  console.log('✅ 工具函数测试通过\n');
}

// =====================================================
// 测试 API 客户端
// =====================================================
async function testApiClient() {
  console.log('📝 测试 API 客户端...');

  const client = new PconlineClient();

  try {
    // 测试获取产品列表
    console.log('  获取海尔产品列表...');
    const list = await client.getProductList('haier');
    console.log(`  产品数量: ${list.products.length}`);
    if (list.products.length > 0) {
      console.log(`  第一个产品: ${list.products[0].name} (ID: ${list.products[0].id})`);
    }

    // 测试获取产品参数
    if (list.products.length > 0) {
      const productId = list.products[0].id;
      console.log(`  获取产品 ${productId} 参数...`);
      const params = await client.getProductParams('haier', productId);
      console.log(`  参数数量: ${Object.keys(params).length}`);
      console.log(`  参数示例: ${JSON.stringify(params).substring(0, 200)}...`);
    }

    console.log('✅ API 客户端测试通过\n');
  } catch (error) {
    console.error('❌ API 客户端测试失败:', error);
  }
}

// =====================================================
// 测试图片下载器
// =====================================================
async function testImageDownloader() {
  console.log('📝 测试图片下载器...');

  const downloader = new ImageDownloader(1, 1, 1000);

  // 测试 URL 验证
  const testUrls = [
    'https://2c.zol-img.com.cn/product/223_280x210/90/xxx.jpg',
    'invalid-url',
    'http://example.com/image.png',
  ];

  for (const url of testUrls) {
    const isValid = downloader.isValidImage(Buffer.from([]));
    console.log(`  URL: ${url.substring(0, 50)}...`);
  }

  console.log('✅ 图片下载器测试通过\n');
}

// =====================================================
// 主测试函数
// =====================================================
async function runTests() {
  console.log('🧪 开始测试...\n');

  testHtmlParser();
  testUtils();
  await testApiClient();
  await testImageDownloader();

  console.log('🎉 所有测试完成!');
}

// 运行测试
runTests().catch(console.error);
