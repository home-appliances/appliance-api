import { Pool } from 'pg'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: resolve(__dirname, '../../.env') })

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'appliance_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres123',
  max: 5,
})

async function analyzeMissingModel() {
  const client = await pool.connect()

  try {
    console.log('🔍 分析缺少型号的数据...')
    console.log('=' .repeat(80))
    console.log('')

    // 1. 统计缺少型号的数据
    const missingResult = await client.query(`
      SELECT COUNT(*) as count
      FROM products
      WHERE model IS NULL OR model = ''
    `)
    console.log(`📊 缺少型号的记录数: ${missingResult.rows[0].count} 条\n`)

    // 2. 分析这些数据的特征
    console.log('📊 缺少型号数据的品牌分布:')
    const brandResult = await client.query(`
      SELECT brand, COUNT(*) as count
      FROM products
      WHERE model IS NULL OR model = ''
      GROUP BY brand
      ORDER BY count DESC
    `)
    for (const row of brandResult.rows) {
      console.log(`   ${row.brand}: ${row.count} 条`)
    }

    console.log('\n📊 缺少型号数据的类别分布:')
    const categoryResult = await client.query(`
      SELECT category, COUNT(*) as count
      FROM products
      WHERE model IS NULL OR model = ''
      GROUP BY category
      ORDER BY count DESC
    `)
    for (const row of categoryResult.rows) {
      console.log(`   ${row.category}: ${row.count} 条`)
    }

    // 3. 查看样本数据，分析能否从 name 或 params 中提取型号
    console.log('\n\n📝 缺少型号的样本数据 (前10条):')
    console.log('-' .repeat(80))

    const sampleResult = await client.query(`
      SELECT id, name, brand, category, params
      FROM products
      WHERE model IS NULL OR model = ''
      LIMIT 10
    `)

    for (const row of sampleResult.rows) {
      console.log(`\nID: ${row.id}`)
      console.log(`名称: ${row.name}`)
      console.log(`品牌: ${row.brand}`)
      console.log(`类别: ${row.category}`)

      // 检查 params 中是否有型号信息
      const params = row.params
      if (params) {
        const paramKeys = Object.keys(params)
        console.log(`参数键: ${paramKeys.join(', ')}`)

        // 查找可能包含型号的键
        const modelKeys = ['型号', '型号(别称)', '产品型号', 'model']
        for (const key of modelKeys) {
          if (params[key]) {
            console.log(`  ${key}: ${params[key]}`)
          }
        }
      }
    }

    // 4. 分析 name 字段中是否包含型号
    console.log('\n\n📊 分析 name 字段中的型号模式:')
    console.log('-' .repeat(80))

    const namePatternResult = await client.query(`
      SELECT
        CASE
          WHEN name ~ '[A-Z]{2,3}-[0-9]+' THEN '包含标准型号格式'
          WHEN name ~ '[A-Z]+[0-9]+' THEN '包含字母数字组合'
          WHEN name ~ '[0-9]+[A-Z]+' THEN '包含数字字母组合'
          ELSE '其他格式'
        END as pattern,
        COUNT(*) as count
      FROM products
      WHERE model IS NULL OR model = ''
      GROUP BY pattern
      ORDER BY count DESC
    `)

    for (const row of namePatternResult.rows) {
      console.log(`   ${row.pattern}: ${row.count} 条`)
    }

    // 5. 尝试从 name 中提取型号
    console.log('\n\n📊 从 name 中提取型号的可行性分析:')
    console.log('-' .repeat(80))

    const extractResult = await client.query(`
      SELECT
        name,
        CASE
          WHEN name ~ '([A-Z]{2,3}-[0-9]+[A-Za-z0-9]*)' THEN
            (regexp_match(name, '([A-Z]{2,3}-[0-9]+[A-Za-z0-9]*)'))[1]
          WHEN name ~ '([A-Z]+[0-9]+[A-Za-z0-9]*)' THEN
            (regexp_match(name, '([A-Z]+[0-9]+[A-Za-z0-9]*)'))[1]
          ELSE NULL
        END as extracted_model
      FROM products
      WHERE model IS NULL OR model = ''
      LIMIT 20
    `)

    let extractable = 0
    for (const row of extractResult.rows) {
      if (row.extracted_model) {
        extractable++
        console.log(`   ✅ "${row.name}" -> "${row.extracted_model}"`)
      } else {
        console.log(`   ❌ "${row.name}" -> 无法提取`)
      }
    }

    console.log(`\n   可提取型号: ${extractable}/${extractResult.rows.length} 条`)

  } catch (error) {
    console.error('❌ 分析过程中出错:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

analyzeMissingModel()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
