/**
 * 修复"未知品牌"产品：从产品名称中提取真实品牌
 *
 * 背景：ZOL 爬虫数据中部分产品 brand 字段为"未知品牌"，
 *      但产品名开头其实包含品牌名（如"TCL KFR-35GW/..."、"Midea（美的）智弧..."）。
 *
 * 策略：
 *   1. 优先匹配中文括号内的中文名："Midea（美的）智弧..." → "美的"
 *   2. 从 name 开头匹配已知品牌字典（长名优先，避免"三菱"覆盖"三菱电机"）
 *   3. 英文品牌名开头（如 "Leader KFR-72GW/..."）→ 映射到中文或保留英文
 *   4. 无法识别的保持"未知品牌"
 *
 * 同时会顺带清理一些明显的品牌归一化问题（合并"三菱"→保留原值，"大金空调"→"大金"等）。
 *
 * 运行: npx tsx scripts/fix-unknown-brands.ts
 *   可选参数: --dry-run  只预览不写入
 *             --category <code>  指定分类（默认 air_condition）
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// ════════════════════════════════════════════════════════════
// 参数解析
// ════════════════════════════════════════════════════════════

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const catArgIdx = args.indexOf('--category');
const CATEGORY_CODE = catArgIdx >= 0 ? args[catArgIdx + 1] : 'air_condition';

// ════════════════════════════════════════════════════════════
// 数据库连接
// ════════════════════════════════════════════════════════════

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'appliance_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres123',
});

// ════════════════════════════════════════════════════════════
// 品牌字典
// ════════════════════════════════════════════════════════════

// 已知品牌（中文优先）。长的放前面，避免短名误匹配。
// 例如 "三菱电机" 必须在 "三菱" 之前匹配。
const BRAND_DICTIONARY = [
  // 4字品牌
  '三菱电机', '三菱重工', '富士通将军', '欧瑞博集成空调', '卡萨帝揽光空调', '小米柔风立式空调', '米家巨省电',
  // 3字品牌
  '卡萨帝', '富士通', '欧瑞博', '格兰仕', '澳柯玛', '荣事达', '小天鹅',
  // 2字品牌
  '格力', '美的', '海尔', '海信', '奥克斯', '志高', '三菱', '大金', '松下',
  '长虹', '康佳', '创维', '华凌', '科龙', '扬子', '新科', '日立', '三星',
  '夏普', '东芝', '云米', '夏新', '酷开', '现代', '深松', '申花', '帝智',
  '乐京', '东宝', '新飞', '先科', '米家', '小米', '飞利浦', '惠而浦',
  '伊莱克斯',
  // 英文品牌（保留原名）
  'COLMO', 'Midea', 'Leader', 'JHS', 'TCL', 'LG',
];

// 英文品牌 → 中文映射（更友好的展示）
const ENG_TO_CHN: Record<string, string> = {
  Midea: '美的',
  Leader: '统帅',
  // 以下保留英文（无广泛使用的中文译名或不需翻译）
  // TCL, COLMO, JHS, LG
};

// 品牌归一化映射（合并重复品牌）
// 例如 "大金空调" → "大金"，"三菱" → 保留（因为"三菱电机"/"三菱重工"已独立）
const BRAND_NORMALIZE: Record<string, string> = {
  '大金空调': '大金',
  '卡萨帝揽光空调': '卡萨帝',
  '小米柔风立式空调': '小米',
  '米家巨省电': '米家',
  '欧瑞博集成空调': '欧瑞博',
  '富士通将军': '富士通',
  // 注意：三菱电机 / 三菱重工 不合并，保留独立品牌
};

// ════════════════════════════════════════════════════════════
// 品牌提取逻辑
// ════════════════════════════════════════════════════════════

/**
 * 从产品名中提取真实品牌
 * @returns 品牌名（已归一化），或 null 表示无法识别
 */
function extractBrandFromName(name: string): string | null {
  if (!name) return null;

  // 1. 优先匹配中文括号内的品牌："Midea（美的）智弧..." → "美的"
  //    同时处理全角（）和半角 ()
  const parenMatch = name.match(/[（(]\s*([^（）()]{2,8})\s*[）)]/);
  if (parenMatch) {
    const inner = parenMatch[1].trim();
    // 括号内必须是纯中文/英文品牌名（不能包含数字、空格、斜杠等）
    if (/^[\u4e00-\u9fa5A-Za-z]+$/.test(inner) && BRAND_DICTIONARY.includes(inner)) {
      return normalizeBrand(inner);
    }
  }

  // 2. 从 name 开头匹配品牌字典（长名优先）
  //    复制并按长度降序排序
  const sortedBrands = [...BRAND_DICTIONARY].sort((a, b) => b.length - a.length);
  for (const brand of sortedBrands) {
    if (name.startsWith(brand)) {
      return normalizeBrand(brand);
    }
  }

  // 3. 英文品牌名开头："Leader KFR-72GW/..." → "统帅"
  //    匹配规则：开头连续 2+ 个英文字母，后面跟空格或非字母
  const engMatch = name.match(/^([A-Za-z]{2,})[\s\/]/);
  if (engMatch) {
    const eng = engMatch[1];
    // 必须在字典里（避免把型号开头当品牌）
    if (BRAND_DICTIONARY.includes(eng)) {
      return normalizeBrand(eng);
    }
  }

  return null;
}

/** 品牌归一化 */
function normalizeBrand(brand: string): string {
  return BRAND_NORMALIZE[brand] || ENG_TO_CHN[brand] || brand;
}

// ════════════════════════════════════════════════════════════
// 主流程
// ════════════════════════════════════════════════════════════

async function main() {
  console.log('🔧 品牌修复工具');
  console.log('='.repeat(60));
  console.log(`📂 分类: ${CATEGORY_CODE}`);
  console.log(`${DRY_RUN ? '🔍 [预览模式] 只解析不写入' : '💾 [写入模式] 将更新数据库'}`);
  console.log('');

  // 1. 获取分类 ID
  const catResult = await pool.query(
    'SELECT id FROM categories WHERE code = $1',
    [CATEGORY_CODE]
  );
  if (catResult.rows.length === 0) {
    console.error(`❌ 数据库中找不到分类: ${CATEGORY_CODE}`);
    process.exit(1);
  }
  const categoryId = catResult.rows[0].id;

  // 2. 查询所有"未知品牌"产品
  const unknownResult = await pool.query(
    `SELECT id, name, brand FROM products
     WHERE category_id = $1 AND brand = '未知品牌' AND deleted_at IS NULL
     ORDER BY id`,
    [categoryId]
  );

  console.log(`📊 找到 ${unknownResult.rows.length} 条"未知品牌"记录\n`);

  if (unknownResult.rows.length === 0) {
    console.log('✅ 没有需要修复的记录');
    await pool.end();
    return;
  }

  // 3. 逐条提取品牌
  const updates: Array<{ id: number; name: string; oldBrand: string; newBrand: string }> = [];
  const cannotFix: Array<{ id: number; name: string }> = [];

  for (const row of unknownResult.rows) {
    const newBrand = extractBrandFromName(row.name);
    if (newBrand && newBrand !== '未知品牌') {
      updates.push({
        id: row.id,
        name: row.name,
        oldBrand: row.brand,
        newBrand,
      });
    } else {
      cannotFix.push({ id: row.id, name: row.name });
    }
  }

  // 4. 打印预览
  console.log('📝 可修复的记录:');
  for (const u of updates) {
    console.log(`   ID ${u.id}: "${u.name}"`);
    console.log(`           → 品牌: ${u.oldBrand} → ${u.newBrand}`);
  }
  console.log(`\n⚠️  无法识别品牌的记录 (${cannotFix.length} 条):`);
  for (const c of cannotFix) {
    console.log(`   ID ${c.id}: "${c.name}"`);
  }
  console.log('');

  // 5. 预览模式：结束
  if (DRY_RUN) {
    console.log(`🔍 [预览模式] 将修复 ${updates.length} 条，跳过 ${cannotFix.length} 条`);
    await pool.end();
    return;
  }

  // 6. 写入数据库
  if (updates.length === 0) {
    console.log('ℹ️  没有可修复的记录');
    await pool.end();
    return;
  }

  console.log(`💾 开始更新 ${updates.length} 条记录...`);
  let updated = 0;
  for (const u of updates) {
    try {
      await pool.query(
        `UPDATE products SET brand = $1, updated_at = NOW() WHERE id = $2`,
        [u.newBrand, u.id]
      );
      updated++;
    } catch (err) {
      console.error(`   ❌ ID ${u.id} 更新失败: ${(err as Error).message}`);
    }
  }
  console.log(`✅ 成功更新 ${updated}/${updates.length} 条\n`);

  // 7. 同步更新搜索向量（brand 变了，搜索向量需要重建）
  console.log('🔍 更新搜索向量...');
  try {
    await pool.query(`
      UPDATE products SET search_vector =
        to_tsvector('jiebacfg', coalesce(name, '') || ' ' || coalesce(brand, '') || ' ' || coalesce(model, ''))
      WHERE category_id = $1 AND deleted_at IS NULL
    `, [categoryId]);
    console.log('✅ 搜索向量更新完成\n');
  } catch (err) {
    console.log(`⚠️  搜索向量更新跳过: ${(err as Error).message}\n`);
  }

  // 8. 最终统计
  const stats = await pool.query(`
    SELECT brand, COUNT(*) as count
    FROM products
    WHERE category_id = $1 AND deleted_at IS NULL
    GROUP BY brand
    ORDER BY count DESC
  `, [categoryId]);

  console.log('='.repeat(60));
  console.log('📊 修复后品牌分布:');
  for (const row of stats.rows) {
    console.log(`   ${row.brand}: ${row.count} 个`);
  }
  console.log('='.repeat(60));

  await pool.end();
  console.log('\n✨ 修复完成！');
}

main().catch((error) => {
  console.error('❌ 执行失败:', error);
  process.exit(1);
});
