/**
 * 修正空调品类参数规范类型（与实际爬虫/库内数据格式对齐）
 * 运行: npx tsx src/db/fix-ac-param-types.ts
 */
import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
})

/** 带单位/复合格式 → text */
const TO_TEXT = [
  '制冷量',
  '制热量',
  '制冷功率',
  '制热功率',
  '制冷电流',
  '制热电流',
  '循环风量',
  '电辅加热功率',
  '室内机噪音',
  '室外机噪音',
  '室内机尺寸',
  '室外机尺寸',
  '室内机质量',
  '室外机质量',
  '除湿量',
  '新风换气量',
  '扫风方式',
  '电源性能',
]

/** 是/否类 → boolean */
const TO_BOOLEAN = [
  '是否静音',
  '电辅加热', // 有无；功率见「电辅加热功率」
]

async function main() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 确认空调分类存在
    const cat = await client.query(
      `SELECT id, code, name FROM categories WHERE code = 'air_condition' OR name LIKE '%空调%' LIMIT 5`
    )
    console.log('分类:', cat.rows)

    const textRes = await client.query(
      `UPDATE category_params
       SET param_type = 'text'
       WHERE param_key = ANY($1::text[])
         AND param_type IS DISTINCT FROM 'text'
       RETURNING param_key, display_name, param_type`,
      [TO_TEXT]
    )
    console.log(`\n→ text (${textRes.rowCount} 条):`)
    textRes.rows.forEach((r) => console.log(`  ${r.param_key} (${r.display_name})`))

    const boolRes = await client.query(
      `UPDATE category_params
       SET param_type = 'boolean',
           enum_values = NULL
       WHERE param_key = ANY($1::text[])
         AND param_type IS DISTINCT FROM 'boolean'
       RETURNING param_key, display_name, param_type`,
      [TO_BOOLEAN]
    )
    console.log(`\n→ boolean (${boolRes.rowCount} 条):`)
    boolRes.rows.forEach((r) => console.log(`  ${r.param_key} (${r.display_name})`))

    // 能效比保持 number（通常为纯小数）
    // 适用面积、产品型号等已是 text，无需改

    const check = await client.query(
      `SELECT param_key, display_name, param_type
       FROM category_params
       WHERE param_key = ANY($1::text[])
       ORDER BY param_key`,
      [[...TO_TEXT, ...TO_BOOLEAN, '能效比', '适用面积', '空调匹数', '上市时间', 'WiFi功能']]
    )
    console.log('\n校验相关参数:')
    console.table(check.rows)

    await client.query('COMMIT')
    console.log('\n✅ 参数类型已更新')
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('❌ 失败:', e)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

main()
