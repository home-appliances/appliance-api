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
  const keyword = '小米空调';
  const searchTerms = ['小米', '空调'];

  console.log('测试搜索:', keyword);
  console.log('分词:', searchTerms);
  console.log('');

  // 构建查询
  const termConditions = searchTerms.map((_, i) => {
    const idx = i + 1;
    return `(name ILIKE $${idx} OR brand ILIKE $${idx} OR model ILIKE $${idx})`;
  }).join(' OR ');

  // 品牌匹配条件
  const brandMatchConditions = searchTerms.map((term, i) => {
    const idx = i + 1;
    const brandMap: Record<string, string> = {
      '小米': 'xiaomi', '格力': 'gree', '海尔': 'haier', '美的': 'midea',
    };
    const mappedBrand = brandMap[term] || term.toLowerCase();
    return `(brand = '${mappedBrand}' OR name ILIKE $${idx})`;
  }).join(' OR ');

  // 类别匹配条件
  const categoryMatchConditions = searchTerms.map((term) => {
    const categoryMap: Record<string, string> = {
      '空调': 'air_condition', '冰箱': 'icebox', '洗衣机': 'washer',
    };
    const cat = categoryMap[term];
    if (cat) {
      return `category = '${cat}'`;
    }
    return 'FALSE';
  }).join(' OR ');

  // 相关性分数
  const relevanceScore = searchTerms.map((_, i) => {
    const idx = i + 1;
    return `(CASE WHEN name ILIKE $${idx} OR brand ILIKE $${idx} OR model ILIKE $${idx} THEN 1 ELSE 0 END)`;
  }).join(' + ');

  const query = `
    SELECT * FROM (
      SELECT id, name, brand, category,
        (${relevanceScore}) as term_match_count,
        CASE WHEN ${brandMatchConditions} THEN 100 ELSE 0 END as brand_boost,
        CASE WHEN ${categoryMatchConditions} THEN 50 ELSE 0 END as category_boost
      FROM products
      WHERE ${termConditions}
    ) sub
    ORDER BY (brand_boost + category_boost + term_match_count * 10) DESC
    LIMIT 10
  `;

  const params = searchTerms.map(t => `%${t}%`);

  console.log('SQL:');
  console.log(query);
  console.log('\n参数:', params);
  console.log('');

  const result = await pool.query(query, params);

  console.log('搜索结果:');
  for (const row of result.rows) {
    console.log(`  [${row.id}] ${row.brand} - ${row.name}`);
    console.log(`    品牌分: ${row.brand_boost}, 类别分: ${row.category_boost}, 词匹配: ${row.term_match_count}`);
  }

  await pool.end();
}
main();
