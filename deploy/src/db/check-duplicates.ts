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

async function checkDuplicates() {
  const client = await pool.connect()

  try {
    console.log('🔍 重复数据检查报告')
    console.log('=' .repeat(100))
    console.log('')

    // 1. 检查 name 重复
    console.log('📊 1. 检查名称 (name) 重复')
    console.log('-' .repeat(100))

    const nameDuplicates = await client.query(`
      SELECT name, COUNT(*) as count
      FROM products
      GROUP BY name
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `)

    if (nameDuplicates.rows.length === 0) {
      console.log('   ✅ 没有发现名称重复的记录')
    } else {
      console.log(`   ⚠️ 发现 ${nameDuplicates.rows.length} 个重复名称:\n`)

      for (const row of nameDuplicates.rows) {
        console.log(`   名称: "${row.name}" (${row.count} 条)`)

        // 获取这些重复记录的详细信息
        const details = await client.query(`
          SELECT id, brand, category, model, source_url, created_at
          FROM products
          WHERE name = $1
          ORDER BY created_at
        `, [row.name])

        for (const detail of details.rows) {
          console.log(`     - ID: ${detail.id}, 品牌: ${detail.brand}, 类别: ${detail.category}`)
          console.log(`       型号: ${detail.model || 'N/A'}`)
          console.log(`       来源: ${detail.source_url}`)
          console.log(`       创建时间: ${detail.created_at}`)
        }
        console.log('')
      }
    }

    // 2. 检查 source_url 重复
    console.log('\n📊 2. 检查来源URL (source_url) 重复')
    console.log('-' .repeat(100))

    const urlDuplicates = await client.query(`
      SELECT source_url, COUNT(*) as count
      FROM products
      GROUP BY source_url
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `)

    if (urlDuplicates.rows.length === 0) {
      console.log('   ✅ 没有发现来源URL重复的记录')
    } else {
      console.log(`   ⚠️ 发现 ${urlDuplicates.rows.length} 个重复URL:\n`)

      for (const row of urlDuplicates.rows) {
        console.log(`   URL: "${row.source_url}" (${row.count} 条)`)

        const details = await client.query(`
          SELECT id, name, brand, category, created_at
          FROM products
          WHERE source_url = $1
          ORDER BY created_at
        `, [row.source_url])

        for (const detail of details.rows) {
          console.log(`     - ID: ${detail.id}, 名称: ${detail.name}`)
          console.log(`       品牌: ${detail.brand}, 类别: ${detail.category}`)
          console.log(`       创建时间: ${detail.created_at}`)
        }
        console.log('')
      }
    }

    // 3. 检查 params 内容重复（相同的参数值）
    console.log('\n📊 3. 检查参数 (params) 内容重复')
    console.log('-' .repeat(100))

    const paramsDuplicates = await client.query(`
      SELECT params::text as params_text, COUNT(*) as count
      FROM products
      GROUP BY params::text
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 10
    `)

    if (paramsDuplicates.rows.length === 0) {
      console.log('   ✅ 没有发现参数内容完全相同的记录')
    } else {
      console.log(`   ⚠️ 发现 ${paramsDuplicates.rows.length} 组参数完全相同的记录:\n`)

      for (const row of paramsDuplicates.rows) {
        const params = JSON.parse(row.params_text)
        console.log(`   参数内容 (${row.count} 条相同):`)

        // 显示部分参数
        const keys = Object.keys(params).slice(0, 3)
        for (const key of keys) {
          console.log(`     ${key}: ${params[key]}`)
        }
        console.log('     ...')
        console.log('')
      }
    }

    // 4. 检查综合重复（名称+品牌+类别）
    console.log('\n📊 4. 检查综合重复（名称+品牌+类别）')
    console.log('-' .repeat(100))

    const compositeDuplicates = await client.query(`
      SELECT name, brand, category, COUNT(*) as count
      FROM products
      GROUP BY name, brand, category
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `)

    if (compositeDuplicates.rows.length === 0) {
      console.log('   ✅ 没有发现综合重复的记录')
    } else {
      console.log(`   ⚠️ 发现 ${compositeDuplicates.rows.length} 组综合重复:\n`)

      for (const row of compositeDuplicates.rows) {
        console.log(`   名称: "${row.name}"`)
        console.log(`   品牌: ${row.brand}, 类别: ${row.category}, 数量: ${row.count} 条`)

        const details = await client.query(`
          SELECT id, model, source_url, created_at
          FROM products
          WHERE name = $1 AND brand = $2 AND category = $3
          ORDER BY created_at
        `, [row.name, row.brand, row.category])

        for (const detail of details.rows) {
          console.log(`     - ID: ${detail.id}, 型号: ${detail.model || 'N/A'}`)
          console.log(`       来源: ${detail.source_url}`)
          console.log(`       创建时间: ${detail.created_at}`)
        }
        console.log('')
      }
    }

    // 5. 总结和建议
    console.log('\n' + '=' .repeat(100))
    console.log('📊 重复数据检查总结')
    console.log('=' .repeat(100))
    console.log('')

    const totalDuplicates = nameDuplicates.rows.length + urlDuplicates.rows.length
    console.log(`   名称重复: ${nameDuplicates.rows.length} 组`)
    console.log(`   URL重复: ${urlDuplicates.rows.length} 组`)
    console.log(`   参数重复: ${paramsDuplicates.rows.length} 组`)
    console.log(`   综合重复: ${compositeDuplicates.rows.length} 组`)
    console.log('')

    if (totalDuplicates === 0) {
      console.log('   ✅ 数据库中没有发现重复数据')
    } else {
      console.log('   ⚠️ 建议处理重复数据:')
      console.log('      1. 保留最新爬取的数据')
      console.log('      2. 删除旧的重复记录')
      console.log('      3. 或者保留所有记录（可能有细微差异）')
    }

    console.log('\n' + '=' .repeat(100))

  } catch (error) {
    console.error('❌ 检查过程中出错:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

checkDuplicates()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
