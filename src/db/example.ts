/**
 * 数据库使用示例
 * 展示如何插入和查询电器数据
 */

import {
  testConnection,
  insertImage,
  insertProduct,
  batchInsertProducts,
  queryByParams,
  queryByParamField,
  queryByBrand,
  searchByName,
  getProductWithImage,
  countByBrand,
  closePool,
} from './index';

async function main() {
  // 测试连接
  const connected = await testConnection();
  if (!connected) {
    console.error('无法连接数据库，请检查配置');
    return;
  }

  try {
    // =====================================================
    // 示例 1：插入单个产品（带图片）
    // =====================================================
    console.log('\n📝 示例 1：插入单个产品');

    // 1.1 先插入图片
    const imageData = Buffer.from('fake-image-data'); // 实际应为真实的图片 Buffer
    const imageId = await insertImage(
      imageData,
      'image/jpeg',
      102400,  // 100KB
      800,
      600
    );
    console.log('图片插入成功，ID:', imageId);

    // 1.2 插入产品
    const productId = await insertProduct({
      name: '格力 KFR-35GW/NhGc1B 空调',
      brand: '格力',
      category: '空调',
      model: 'KFR-35GW/NhGc1B',
      params: {
        power: '1.5匹',
        energy_level: '一级能效',
        voltage: '220V',
        cooling_capacity: '3500W',
        heating_capacity: '4600W',
        noise_level: '18-37dB',
        refrigerant: 'R32',
        indoor_unit_size: '885×290×205mm',
        outdoor_unit_size: '850×540×318mm',
        weight_indoor: '9.5kg',
        weight_outdoor: '32kg',
      },
      imageId,
      'https://item.jd.com/100012043978.html',
      '京东',
    });
    console.log('产品插入成功，ID:', productId);

    // =====================================================
    // 示例 2：批量插入产品
    // =====================================================
    console.log('\n📝 示例 2：批量插入产品');

    const batchProducts = [
      {
        name: '美的 BCD-258WTPZM(E) 冰箱',
        brand: '美的',
        category: '冰箱',
        model: 'BCD-258WTPZM(E)',
        params: {
          capacity: '258L',
          energy_level: '一级能效',
          type: '风冷无霜',
          dimensions: '583×650×1775mm',
          weight: '68kg',
        },
        sourceUrl: 'https://item.jd.com/100015264692.html',
        sourcePlatform: '京东',
      },
      {
        name: '西门子 WA42D8B9W 洗衣机',
        brand: '西门子',
        category: '洗衣机',
        model: 'WA42D8B9W',
        params: {
          capacity: '9kg',
          energy_level: '一级能效',
          type: '滚筒洗衣机',
          speed: '1400rpm',
          dimensions: '848×598×628mm',
          weight: '76kg',
        },
        sourceUrl: 'https://item.jd.com/100012134530.html',
        sourcePlatform: '京东',
      },
      {
        name: '格力 KFR-72LW/NhGm1BAj 空调',
        brand: '格力',
        category: '空调',
        model: 'KFR-72LW/NhGm1BAj',
        params: {
          power: '3匹',
          energy_level: '一级能效',
          voltage: '220V',
          cooling_capacity: '7200W',
          heating_capacity: '9100W',
          type: '立柜式',
        },
        sourceUrl: 'https://item.jd.com/100015193498.html',
        sourcePlatform: '京东',
      },
    ];

    const batchIds = await batchInsertProducts(batchProducts);
    console.log('批量插入成功，IDs:', batchIds);

    // =====================================================
    // 示例 3：JSONB 查询
    // =====================================================
    console.log('\n📝 示例 3：JSONB 查询');

    // 3.1 使用 @> 包含查询
    console.log('\n查询一级能效产品：');
    const energyEfficient = await queryByParams({ energy_level: '一级能效' });
    console.log(`找到 ${energyEfficient.length} 个产品`);
    energyEfficient.forEach(p => console.log(`  - ${p.name}`));

    // 3.2 使用 ->> 字段查询
    console.log('\n查询 1.5 匹空调：');
    const powerProducts = await queryByParamField('power', '1.5匹');
    console.log(`找到 ${powerProducts.length} 个产品`);
    powerProducts.forEach(p => console.log(`  - ${p.name}`));

    // =====================================================
    // 示例 4：按品牌查询
    // =====================================================
    console.log('\n📝 示例 4：按品牌查询');

    const格力Products = await queryByBrand('格力');
    console.log(`格力产品共 ${格力Products.length} 个：`);
    格力Products.forEach(p => console.log(`  - ${p.name}`));

    // =====================================================
    // 示例 5：全文搜索
    // =====================================================
    console.log('\n📝 示例 5：全文搜索');

    const searchResults = await searchByName('空调');
    console.log(`搜索"空调"找到 ${searchResults.length} 个结果：`);
    searchResults.forEach(p => console.log(`  - ${p.name}`));

    // =====================================================
    // 示例 6：获取产品详情（含图片）
    // =====================================================
    console.log('\n📝 示例 6：获取产品详情');

    const detail = await getProductWithImage(productId);
    if (detail) {
      console.log('产品名称:', detail.name);
      console.log('品牌:', detail.brand);
      console.log('参数:', detail.params);
      console.log('图片大小:', detail.file_size, 'bytes');
    }

    // =====================================================
    // 示例 7：统计信息
    // =====================================================
    console.log('\n📝 示例 7：按品牌统计');

    const brandStats = await countByBrand();
    console.log('品牌产品数量统计：');
    brandStats.forEach(s => console.log(`  ${s.brand}: ${s.count} 个`));

  } catch (error) {
    console.error('执行示例时出错:', error);
  } finally {
    await closePool();
  }
}

// 运行示例
main();
