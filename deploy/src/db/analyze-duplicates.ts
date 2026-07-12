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

async function analyzeDuplicates() {
  const client = await pool.connect()

  try {
    console.log('🔍 重复数据详细分析')
    console.log('=' .repeat(100))
    console.log('')

    // 1. 分析名称重复的记录
    console.log('📊 1. 分析名称重复的记录')
    console.log('-' .repeat(100))

    const duplicateRecords = await client.query(`
      SELECT id, name, brand, category, model, params, source_url, created_at
      FROM products
      WHERE name = '新飞BCD-175K2AT'
      ORDER BY created_at
    `)

    console.log(`找到 ${duplicateRecords.rows.length} 条重复记录:\n`)

    for (const record of duplicateRecords.rows) {
      console.log(`ID: ${record.id}`)
      console.log(`名称: ${record.name}`)
      console.log(`品牌: ${record.brand}`)
      console.log(`类别: ${record.category}`)
      console.log(`型号: ${record.model}`)
      console.log(`来源URL: ${record.source_url}`)
      console.log(`创建时间: ${record.created_at}`)
      console.log(`参数: ${JSON.stringify(record.params, null, 2)}`)
      console.log('')
    }

    // 2. 比较参数差异
    console.log('\n📊 2. 比较参数差异')
    console.log('-' .repeat(100))

    if (duplicateRecords.rows.length === 2) {
      const record1 = duplicateRecords.rows[0]
      const record2 = duplicateRecords.rows[1]

      const params1 = record1.params
      const params2 = record2.params

      const keys1 = Object.keys(params1)
      const keys2 = Object.keys(params2)

      console.log(`记录1 (ID: ${record1.id}) 参数数量: ${keys1.length}`)
      console.log(`记录2 (ID: ${record2.id}) 参数数量: ${keys2.length}`)

      // 找出不同的键
      const onlyIn1 = keys1.filter(k => !keys2.includes(k))
      const onlyIn2 = keys2.filter(k => !keys1.includes(k))

      if (onlyIn1.length > 0) {
        console.log(`\n仅在记录1中存在的键: ${onlyIn1.join(', ')}`)
      }
      if (onlyIn2.length > 0) {
        console.log(`仅在记录2中存在的键: ${onlyIn2.join(', ')}`)
      }

      // 比较相同键的值
      const commonKeys = keys1.filter(k => keys2.includes(k))
      const diffValues: Array<{key: string, value1: string, value2: string}> = []

      for (const key of commonKeys) {
        if (params1[key] !== params2[key]) {
          diffValues.push({
            key,
            value1: params1[key],
            value2: params2[key]
          })
        }
      }

      if (diffValues.length > 0) {
        console.log(`\n参数值不同的键 (${diffValues.length} 个):`)
        for (const diff of diffValues) {
          console.log(`  ${diff.key}:`)
          console.log(`    记录1: ${diff.value1}`)
          console.log(`    记录2: ${diff.value2}`)
        }
      } else {
        console.log('\n所有相同键的参数值都相同')
      }

      // 结论
      console.log('\n📊 3. 分析结论')
      console.log('-' .repeat(100))

      if (onlyIn1.length === 0 && onlyIn2.length === 0 && diffValues.length === 0) {
        console.log('   ✅ 两条记录的参数完全相同')
        console.log('   📝 建议: 可以去重，保留最新的一条')
        console.log(`   🗑️  建议删除: ID ${record1.id} (创建时间较早)`)
      } else {
        console.log('   ⚠️ 两条记录的参数存在差异')
        console.log('   📝 建议: 保留两条记录，它们可能是同一产品的不同配置')
      }
    }

    // 4. 检查参数重复但名称不同的情况
    console.log('\n\n📊 4. 检查参数重复但名称不同的情况')
    console.log('-' .repeat(100))

    const paramsDuplicates = await client.query(`
      WITH params_groups AS (
        SELECT params::text as params_text,
               array_agg(id) as ids,
               array_agg(name) as names,
               array_agg(DISTINCT name) as unique_names
        FROM products
        GROUP BY params::text
        HAVING COUNT(*) > 1
      )
      SELECT
        params_text,
        ids,
        names,
        unique_names,
        array_length(unique_names, 1) as unique_count
      FROM params_groups
      WHERE array_length(unique_names, 1) > 1
      LIMIT 5
    `)

    if (paramsDuplicates.rows.length === 0) {
      console.log('   ✅ 没有发现参数相同但名称不同的记录')
    } else {
      console.log(`   ⚠️ 发现 ${paramsDuplicates.rows.length} 组参数相同但名称不同的记录:\n`)

      for (const row of paramsDuplicates.rows) {
        console.log(`   参数内容 (${row.ids.length} 条记录):`)
        console.log(`     包含 ${row.unique_count} 个不同名称:`)
        for (const name of row.unique_names) {
          console.log(`       - ${name}`)
        }
        console.log('')
      }
    }

    // 5. 最终建议
    console.log('\n' + '=' .repeat(100))
    console.log('📊 最终建议')
    console.log('=' .repeat(100))
    console.log('')

    console.log('1. 名称重复的记录 ("新飞BCD-175K2AT"):')
    console.log('   - 两条记录来自不同的URL，可能是同一产品的不同页面')
    console.log('   - 如果参数完全相同，可以去重，保留最新的一条')
    console.log('   - 如果参数有差异，可能是同一产品的不同配置，建议保留')
    console.log('')
    console.log('2. 参数重复但名称不同的记录:')
    console.log('   - 这些可能是不同型号但参数相似的产品')
    console.log('   - 建议保留所有记录，因为它们可能是有效的产品数据')
    console.log('')
    console.log('3. 总体建议:')
    console.log('   - 只对完全相同的记录进行去重')
    console.log('   - 保留所有有差异的记录，即使它们很相似')
    console.log('   - 去重时保留最新爬取的数据')

  } catch (error) {
    console.error('❌ 分析过程中出错:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

analyzeDuplicates()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
