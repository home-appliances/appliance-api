/**
 * check-db-data.ts
 * 检查数据库 products 表的空调数据: 总量 / 字段覆盖率 / 残留脏值 / 样本
 * 用法: cd hono && npx tsx src/db/check-db-data.ts
 */
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const q = (sql: string) => pool.query(sql).then((r) => r.rows);

(async () => {
  try {
    console.log('\n===== 1. 各 category 产品数 =====');
    const cats = await q(`SELECT category, count(*)::int AS n FROM products GROUP BY category ORDER BY n DESC`);
    console.table(cats);

    const totalRow = await q(`SELECT count(*)::int AS n FROM products WHERE category='air_condition'`);
    const total = totalRow[0].n;
    console.log(`空调类(air_condition)总数: ${total}\n`);

    console.log('===== 2. 空调类 params 各字段覆盖率(非空数 / 总数) =====');
    const cov = await q(`
      SELECT k AS field, count(*)::int AS filled
      FROM products
      CROSS JOIN LATERAL jsonb_object_keys(params) AS k
      WHERE category='air_condition'
      GROUP BY k ORDER BY filled DESC`);
    for (const c of cov) {
      console.log(`  ${c.field}: ${c.filled}/${total} (${((100 * c.filled) / total).toFixed(1)}%)`);
    }

    console.log('\n===== 3. 残留脏值统计(>0 说明数据库未清洗) =====');
    const dirtStat = await q(`
      SELECT
        count(*) FILTER (WHERE v = '0W' OR v = '0')            AS 单冷零值,
        count(*) FILTER (WHERE v ~ '^\\d\\.\\d+W$')            AS 小数点错位,
        count(*) FILTER (WHERE v ~ '^\\.\\d')                  AS 前导点,
        count(*) FILTER (WHERE v ~ '\\d{7,}')                 AS 数字粘连,
        count(*) FILTER (WHERE v ~ '\\d \\d{3}')              AS 千分位空格
      FROM products
      CROSS JOIN LATERAL jsonb_each_text(params) AS e(k, v)
      WHERE category='air_condition'`);
    console.table(dirtStat[0]);
    const dirtTotal = await q(`
      SELECT count(*)::int AS n
      FROM products
      CROSS JOIN LATERAL jsonb_each_text(params) AS e(k, v)
      WHERE category='air_condition'
        AND (v = '0W' OR v = '0' OR v ~ '^\\d\\.\\d+W$' OR v ~ '^\\.\\d'
             OR v ~ '\\d{7,}' OR v ~ '\\d \\d{3}')`);
    console.log(`  脏值字段总计: ${dirtTotal[0].n} 处`);

    console.log('\n===== 4. 样本(2 条空调完整 params) =====');
    const samples = await q(`SELECT name, brand, params FROM products WHERE category='air_condition' LIMIT 2`);
    for (const s of samples) {
      console.log(`\n  [${s.brand}] ${s.name}`);
      console.log('  ', JSON.stringify(s.params, null, 2).replace(/\n/g, '\n   '));
    }
  } catch (e) {
    console.error('查询失败:', (e as Error).message);
  } finally {
    await pool.end();
  }
})();
