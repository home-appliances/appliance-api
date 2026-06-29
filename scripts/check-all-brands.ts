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

async function main() {
  // 获取所有品牌及其数量
  const result = await pool.query(`
    SELECT brand, COUNT(*) as count
    FROM products
    GROUP BY brand
    ORDER BY count DESC
  `);

  console.log('数据库中所有品牌:\n');
  console.log('品牌 | 数量');
  console.log('-----|------');

  for (const row of result.rows) {
    console.log(`${row.brand} | ${row.count}`);
  }

  console.log(`\n总计: ${result.rows.length} 个品牌`);

  // 检查可能需要合并的品牌
  console.log('\n\n可能需要合并的品牌:');

  // 检查相似品牌
  const similarBrands = [
    ['haier', 'casarte', 'leader'],  // 海尔、卡萨帝、统帅
    ['midea', 'colmo', 'wahin'],  // 美的、COLMO、华凌
    ['gree', 'toshi'],  // 格力、大松
    ['hisense', 'konka'],  // 海信、康佳
    ['tcl', 'changhong'],  // TCL、长虹
    ['panasonic', 'matsushita'],  // 松下
    ['samsung', 'samsung'],  // 三星
    ['lg', 'lg'],  // LG
    ['mitsubishi', 'mitsubishi_electric', 'mitsubishi_heavy'],  // 三菱
    ['daikin', 'daikin'],  // 大金
    ['aux', 'aux'],  // 奥克斯
    ['chigo', 'chigo'],  // 志高
    ['kelon', 'kelon'],  // 科龙
    ['rongsheng', 'rongsheng'],  // 容声
    ['whirlpool', 'whirlpool'],  // 惠而浦
    ['electrolux', 'electrolux'],  // 伊莱克斯
    ['bosch', 'siemens'],  // 博世、西门子
    ['philips', 'philips'],  // 飞利浦
    ['sony', 'sony'],  // 索尼
    ['sharp', 'sharp'],  // 夏普
    ['toshiba', 'toshiba'],  // 东芝
    ['hitachi', 'hitachi'],  // 日立
    ['fujitsu', 'fujitsu'],  // 富士通
    ['general', 'general'],  // 将军
    ['york', 'york'],  // 约克
    ['carrier', 'carrier'],  // 开利
    ['trane', 'trane'],  // 特灵
  ];

  console.log('\n检查结果:');
  for (const group of similarBrands) {
    const brands = group.filter((v, i, a) => a.indexOf(v) === i); // 去重
    if (brands.length > 1) {
      const placeholders = brands.map((_, i) => `$${i + 1}`).join(',');
      const checkResult = await pool.query(
        `SELECT brand, COUNT(*) as count FROM products WHERE brand IN (${placeholders}) GROUP BY brand`,
        brands
      );
      if (checkResult.rows.length > 1) {
        console.log(`\n${brands.join(' / ')}:`);
        for (const row of checkResult.rows) {
          console.log(`  - ${row.brand}: ${row.count} 条`);
        }
      }
    }
  }

  await pool.end();
}
main();
