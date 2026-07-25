/**
 * 用 dump 里的数据覆盖线上 categories 和 category_params
 *
 * 数据来源: appliance_db_backup_20260726_010635.sql
 *
 * 策略:
 *   - categories: 16 条，id/code 与线上完全一致，UPSERT 覆盖
 *   - category_params: 先清空再导入（dump 的 id 是固定值，直接 COPY）
 *
 * 安全性:
 *   - categories.id 与 products.category_id 外键一致，不会孤立产品
 *   - category_params 无外键被引用，清空安全
 *   - 不动 products / product_images / 其他表
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// =====================================================
// 数据（来自 dump 文件）
// =====================================================

// categories: id, code, name, display_name, icon, parent_id, sort_order, is_active
const categories = [
  [2, 'icebox', '冰箱', '冰箱', '🧊', null, 2, true],
  [3, 'washer', '洗衣机', '洗衣机', '👕', null, 3, true],
  [4, 'gas_water', '燃气热水器', '燃气热水器', '🔥', null, 4, true],
  [5, 'central_water', '中央热水器', '中央热水器', '♨️', null, 5, true],
  [6, 'heater', '取暖器', '取暖器', '🌡️', null, 6, true],
  [7, 'lcd_tv', '液晶电视', '电视', '📺', null, 7, true],
  [8, 'rice_cooker', '电饭煲', '电饭煲', '🍚', null, 8, true],
  [9, 'dishwasher', '洗碗机', '洗碗机', '🍽️', null, 9, true],
  [10, 'washer_dryer', '洗烘一体机', '洗烘一体机', '🌀', null, 10, true],
  [11, 'freezer', '冷柜', '冷柜', '❄️', null, 11, true],
  [12, 'range_hood', '油烟机', '油烟机', '💨', null, 12, true],
  [13, 'gas_stove', '燃气灶', '燃气灶', '🔥', null, 13, true],
  [14, 'microwave', '微波炉', '微波炉', '📡', null, 14, true],
  [15, 'oven', '烤箱', '烤箱', '🥐', null, 15, true],
  [16, 'air_fryer', '空气炸锅', '空气炸锅', '🍟', null, 16, true],
  [1, 'air_condition', '空调', '空调', '❄️', null, 1, true],
];

// category_params: 从 dump 解析（id, category_id, param_key, display_name, icon, param_type, is_core, is_filter, is_sortable, enum_values, sort_order）
// 注意: boolean 字段 dump 里是 t/f
const categoryParams = [
  [37, 1, '电源性能', '电源性能', null, 'text', true, false, false, null, 30],
  [2, 1, '能效等级', '能效', '🌿', 'enum', true, true, false, ['一级', '二级', '三级', '四级', '五级'], 2],
  [6, 1, '适用面积', '面积', '📐', 'text', true, true, false, null, 6],
  [57, 1, '精准控温', '精准控温', null, 'text', true, false, false, null, 60],
  [4, 1, '变频/定频', '变频', '💡', 'enum', false, true, false, ['变频', '定频'], 4],
  [60, 1, '高温制冷', '高温制冷', null, 'text', true, false, false, null, 63],
  [25, 1, '系列名称', '系列名称', null, 'text', true, false, false, null, 12],
  [50, 1, '扫风方式', '扫风方式', null, 'text', true, true, false, null, 53],
  [5, 1, '制冷量', '制冷量', '❄️', 'text', true, true, false, null, 5],
  [29, 1, '制冷功率', '制冷功率', null, 'text', true, false, false, null, 22],
  [23, 1, '产品型号', '产品型号', null, 'text', true, false, false, null, 10],
  [43, 1, '室内机尺寸', '室内机尺寸', null, 'text', true, false, false, null, 42],
  [28, 1, '制热量', '制热量', null, 'text', true, false, false, null, 21],
  [34, 1, '循环风量', '循环风量', null, 'text', true, false, false, null, 27],
  [30, 1, '制热功率', '制热功率', null, 'text', true, false, false, null, 23],
  [35, 1, '压缩机', '压缩机', null, 'text', true, false, false, null, 28],
  [36, 1, '制冷剂', '制冷剂', null, 'text', true, false, false, null, 29],
  [31, 1, '制冷电流', '制冷电流', null, 'text', true, false, false, null, 24],
  [32, 1, '制热电流', '制热电流', null, 'text', true, false, false, null, 25],
  [39, 1, '电辅加热功率', '电辅加热功率', null, 'text', true, false, false, null, 32],
  [41, 1, '室内机噪音', '室内机噪音', null, 'text', true, false, false, null, 40],
  [42, 1, '室外机噪音', '室外机噪音', null, 'text', true, false, false, null, 41],
  [44, 1, '室外机尺寸', '室外机尺寸', null, 'text', true, false, false, null, 43],
  [45, 1, '室内机质量', '室内机质量', null, 'text', true, false, false, null, 44],
  [46, 1, '室外机质量', '室外机质量', null, 'text', true, false, false, null, 45],
  [54, 1, '除湿量', '除湿量', null, 'text', true, false, false, null, 57],
  [48, 1, '杀菌类型', '杀菌类型', null, 'text', true, false, false, null, 51],
  [49, 1, '睡眠模式', '睡眠模式', null, 'text', true, false, false, null, 52],
  [22, 1, '是否静音', '是否静音', null, 'boolean', true, true, false, null, 7],
  [51, 1, '控制方式', '控制方式', null, 'text', true, false, false, null, 54],
  [1, 1, '空调匹数', '匹数', '⚡', 'enum', true, true, false, ['1匹', '1.5匹', '2匹', '2.5匹', '3匹', '4匹', '5匹', '5.6匹', '6匹', '7匹', '7.2匹', '8匹', '9匹', '10匹', '16匹', '25匹', '大1匹', '大1.5匹', '大2匹', '大3匹', '大6匹', '小1匹', '小1.5匹', '小2匹', '小6匹'], 1],
  [53, 1, '除霜功能', '除霜功能', null, 'text', true, false, false, null, 56],
  [3, 1, '冷暖类型', '冷暖', '🔄', 'enum', true, false, false, ['冷暖', '单冷', '电辅热', '单热'], 3],
  [24, 1, '空调类型', '空调类型', null, 'enum', true, true, false, ['壁挂式空调', '立柜式', '中央空调', '移动空调', '嵌入式空调', '基站空调', '工业空调'], 11],
  [38, 1, '电辅加热', '电辅加热', null, 'boolean', true, false, false, null, 31],
  [47, 1, '清洁功能', '清洁功能', null, 'boolean', true, true, false, null, 50],
  [52, 1, '独立除湿', '独立除湿', null, 'boolean', true, false, false, null, 55],
  [56, 1, '智能分区送风', '智能分区送风', null, 'boolean', true, false, false, null, 59],
  [58, 1, '缺氟保护设计', '缺氟保护设计', null, 'boolean', true, false, false, null, 61],
  [59, 1, '超低电压启动', '超低电压启动', null, 'boolean', true, false, false, null, 62],
  [55, 1, 'WiFi功能', 'WiFi功能', null, 'boolean', true, false, false, null, 58],
  [26, 1, '上市时间', '上市时间', null, 'date', true, false, false, null, 13],
  [33, 1, '能效比', '能效比', null, 'number', true, false, false, null, 26],
  [78, 1, '其他特点', '其他特点', null, 'text', true, false, false, null, 98],
  [77, 1, '其他性能', '其他性能', null, 'text', true, false, false, null, 97],
  [76, 1, '包装清单', '包装清单', null, 'text', true, false, false, null, 96],
  [75, 1, '电话备注', '电话备注', null, 'text', true, false, false, null, 95],
  [74, 1, '客服电话', '客服电话', null, 'text', true, false, false, null, 94],
  [73, 1, '详细内容', '详细内容', null, 'text', true, false, false, null, 93],
  [72, 1, '质保备注', '质保备注', null, 'text', true, false, false, null, 92],
  [71, 1, '质保时间', '质保时间', null, 'text', true, false, false, null, 91],
  [70, 1, '保修政策', '保修政策', null, 'text', true, false, false, null, 90],
  [64, 1, '显示屏', '显示屏', null, 'text', true, false, false, null, 67],
  [66, 1, '机身颜色', '机身颜色', null, 'text', true, false, false, null, 80],
  [67, 1, '外形设计', '外形设计', null, 'text', true, false, false, null, 81],
  [68, 1, '房间类型', '房间类型', null, 'text', true, false, false, null, 82],
  [65, 1, '停电补偿', '停电补偿', null, 'boolean', true, false, false, null, 68],
  [62, 1, '新风换气量', '新风换气量', null, 'text', true, false, false, null, 65],
  [79, 1, '电辅加热电流', '电辅加热电流', null, 'text', true, false, false, null, 0],
  [81, 1, '空气净化', '空气净化', null, 'text', true, false, false, null, 0],
  [80, 1, '可选配件', '可选配件', null, 'text', true, false, false, null, 0],
  [69, 1, '应用场景', '应用场景', null, 'enum', false, true, false, ['家用', '商用', '工业', '办公'], 83],
  [61, 1, '低温启动', '低温启动', null, 'text', true, false, false, null, 64],
];

async function main() {
  const client = await pool.connect();
  try {
    console.log('🔧 覆盖 categories 和 category_params...\n');

    // ============ 1. categories ============
    console.log(`1️⃣ 覆盖 categories (${categories.length} 条)...`);
    for (const [id, code, name, displayName, icon, parentId, sortOrder, isActive] of categories) {
      await client.query(`
        INSERT INTO categories (id, code, name, display_name, icon, parent_id, sort_order, is_active, created_at)
        OVERRIDING SYSTEM VALUE
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT (id) DO UPDATE SET
          code = EXCLUDED.code,
          name = EXCLUDED.name,
          display_name = EXCLUDED.display_name,
          icon = EXCLUDED.icon,
          parent_id = EXCLUDED.parent_id,
          sort_order = EXCLUDED.sort_order,
          is_active = EXCLUDED.is_active
      `, [id, code, name, displayName, icon, parentId, sortOrder, isActive]);
    }
    // 重置序列
    await client.query(`SELECT setval('categories_id_seq', GREATEST(MAX(id), 16), true) FROM categories;`);
    console.log('   ✅ 完成');

    // ============ 2. category_params ============
    console.log(`2️⃣ 覆盖 category_params (${categoryParams.length} 条)...`);
    // 先清空（无外键引用，安全）
    await client.query('DELETE FROM category_params;');
    // 重置序列到 81（dump 里 setval 是 81）
    await client.query('ALTER TABLE category_params ALTER COLUMN id RESTART WITH 100;');

    for (const [id, categoryId, paramKey, displayName, icon, paramType, isCore, isFilter, isSortable, enumValues, sortOrder] of categoryParams) {
      await client.query(`
        INSERT INTO category_params (id, category_id, param_key, display_name, icon, param_type, is_core, is_filter, is_sortable, enum_values, sort_order, created_at)
        OVERRIDING SYSTEM VALUE
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        ON CONFLICT (category_id, param_key) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          icon = EXCLUDED.icon,
          param_type = EXCLUDED.param_type,
          is_core = EXCLUDED.is_core,
          is_filter = EXCLUDED.is_filter,
          is_sortable = EXCLUDED.is_sortable,
          enum_values = EXCLUDED.enum_values,
          sort_order = EXCLUDED.sort_order
      `, [id, categoryId, paramKey, displayName, icon, paramType, isCore, isFilter, isSortable, enumValues ? JSON.stringify(enumValues) : null, sortOrder]);
    }
    // 重置序列到最大 id
    await client.query(`SELECT setval('category_params_id_seq', GREATEST(MAX(id), 81), true) FROM category_params;`);
    console.log('   ✅ 完成');

    // ============ 3. 验证 ============
    console.log('\n📝 验证:');
    const catCnt = await client.query('SELECT COUNT(*) as c FROM categories');
    const paramCnt = await client.query('SELECT COUNT(*) as c FROM category_params');
    console.log(`   categories: ${catCnt.rows[0].c} 条`);
    console.log(`   category_params: ${paramCnt.rows[0].c} 条`);

    const byCat = await client.query(`
      SELECT c.code, c.name, COUNT(cp.id) as param_count
      FROM categories c LEFT JOIN category_params cp ON c.id = cp.category_id
      GROUP BY c.id, c.code, c.name HAVING COUNT(cp.id) > 0 ORDER BY c.id;
    `);
    console.log('\n   各分类参数数量:');
    for (const r of byCat.rows) {
      console.log(`     ${r.code} (${r.name}): ${r.param_count} 条`);
    }

    // 确认 products 引用未受影响
    const prodCats = await client.query('SELECT category_id, COUNT(*) as cnt FROM products WHERE category_id IS NOT NULL GROUP BY category_id ORDER BY category_id;');
    console.log('\n   products 引用检查:');
    for (const r of prodCats.rows) {
      const cat = await client.query('SELECT code, name FROM categories WHERE id = $1', [r.category_id]);
      console.log(`     category_id=${r.category_id} (${cat.rows[0]?.code || '??'}): ${r.cnt} 个产品 ✅`);
    }

    console.log('\n🎉 覆盖完成!');
  } catch (e) {
    console.error('❌ 失败:', e);
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
