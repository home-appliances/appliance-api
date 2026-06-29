import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'appliance_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres123',
});

// 品牌合并规则：子品牌 → 主品牌
const brandMerges: Array<{ from: string[]; to: string; name: string }> = [
  // 海尔集团
  { from: ['casarte'], to: 'haier', name: '卡萨帝 → 海尔' },
  { from: ['leader'], to: 'haier', name: '统帅 → 海尔' },

  // 美的集团
  { from: ['colmo'], to: 'midea', name: 'COLMO → 美的' },
  { from: ['wahin'], to: 'midea', name: '华凌 → 美的' },

  // 海信集团
  { from: ['ronsheng'], to: 'hisense', name: '容声 → 海信' },

  // 三菱集团
  { from: ['mitsubishi_electric'], to: 'mitsubishi', name: '三菱电机 → 三菱' },
  { from: ['mitsubishi_heavy'], to: 'mitsubishi', name: '三菱重工 → 三菱' },
  { from: ['mhi'], to: 'mitsubishi', name: 'MHI → 三菱' },

  // 松下
  { from: ['matsushita'], to: 'panasonic', name: '松下 → Panasonic' },

  // 富士通
  { from: ['fujitsu_general'], to: 'fujitsu', name: '富士通将军 → 富士通' },

  // 小天鹅
  { from: ['littleswan'], to: 'midea', name: '小天鹅 → 美的' },

  // 创维
  { from: ['coocaa'], to: 'skyworth', name: '酷开 → 创维' },
];

async function main() {
  console.log('🔄 开始合并品牌...\n');

  let totalUpdated = 0;

  for (const merge of brandMerges) {
    for (const from of merge.from) {
      const result = await pool.query(
        `UPDATE products SET brand = $1 WHERE brand = $2 RETURNING id`,
        [merge.to, from]
      );

      if (result.rowCount && result.rowCount > 0) {
        console.log(`✅ ${merge.name}: ${result.rowCount} 条`);
        totalUpdated += result.rowCount;
      }
    }
  }

  console.log(`\n📊 共更新 ${totalUpdated} 条产品\n`);

  // 更新拼音字段
  console.log('更新拼音字段...');
  await pool.query(`
    UPDATE products
    SET pinyin = to_tsvector('simple', name || ' ' || brand || ' ' || model)::text,
        pinyin_initials = ''
    WHERE brand IN ('haier', 'midea', 'hisense', 'mitsubishi', 'panasonic', 'fujitsu', 'skyworth')
  `);

  // 显示合并后的品牌统计
  const result = await pool.query(`
    SELECT brand, COUNT(*) as count
    FROM products
    GROUP BY brand
    ORDER BY count DESC
    LIMIT 30
  `);

  console.log('\n合并后的品牌统计 (前30):\n');
  console.log('品牌 | 数量');
  console.log('-----|------');

  for (const row of result.rows) {
    console.log(`${row.brand} | ${row.count}`);
  }

  // 检查是否还有需要合并的
  console.log('\n\n检查是否还有相似品牌需要合并:');
  const checkBrands = [
    ['tcl', 'changhong'],
    ['kelon', 'hisense'],
    ['aux', 'aux'],
    ['chigo', 'chigo'],
  ];

  for (const group of checkBrands) {
    const placeholders = group.map((_, i) => `$${i + 1}`).join(',');
    const checkResult = await pool.query(
      `SELECT brand, COUNT(*) as count FROM products WHERE brand IN (${placeholders}) GROUP BY brand`,
      group
    );
    if (checkResult.rows.length > 1) {
      console.log(`\n${group.join(' / ')}:`);
      for (const row of checkResult.rows) {
        console.log(`  - ${row.brand}: ${row.count} 条`);
      }
    }
  }

  await pool.end();
}
main();
