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

async function checkData() {
  const client = await pool.connect()

  try {
    console.log('🔍 检查数据库中的数据格式...\n')

    // 1. 查看数据总量
    const countResult = await client.query('SELECT COUNT(*) as total FROM products')
    console.log(`📊 数据库中共有 ${countResult.rows[0].total} 条记录\n`)

    // 2. 查看前5条数据的 params 字段结构
    console.log('📝 前5条数据的 params 字段内容:')
    console.log('=' .repeat(80))

    const sampleResult = await client.query(`
      SELECT id, name, params
      FROM products
      LIMIT 5
    `)

    for (const row of sampleResult.rows) {
      console.log(`\nID: ${row.id}`)
      console.log(`Name: ${row.name}`)
      console.log(`Params 类型: ${typeof row.params}`)

      if (row.params && typeof row.params === 'object') {
        const keys = Object.keys(row.params)
        console.log(`Params 键数量: ${keys.length}`)

        // 显示每个键的值（截断过长的内容）
        for (const key of keys) {
          const value = row.params[key]
          const displayValue = typeof value === 'string'
            ? (value.length > 50 ? value.substring(0, 50) + '...' : value)
            : JSON.stringify(value)
          console.log(`  ${key}: ${displayValue}`)
        }
      }
    }

    // 3. 搜索可能的无用文本模式
    console.log('\n\n🔍 搜索可能的无用文本模式...')
    console.log('=' .repeat(80))

    const patterns = [
      { name: '·查看所有', pattern: '%·查看所有%' },
      { name: '什么是', pattern: '%什么是%' },
      { name: '有哪些', pattern: '%有哪些%' },
      { name: '查看所有', pattern: '%查看所有%' },
      { name: '是什么', pattern: '%是什么%' },
      { name: '（', pattern: '%（%' },
      { name: '(', pattern: '%(%' },
    ]

    for (const p of patterns) {
      const result = await client.query(
        'SELECT COUNT(*) as count FROM products WHERE params::text LIKE $1',
        [p.pattern]
      )
      const count = parseInt(result.rows[0].count)
      if (count > 0) {
        console.log(`   "${p.name}": ${count} 条记录`)
      }
    }

    // 4. 查看 params 中所有值的类型分布
    console.log('\n\n📊 params 字段中的值类型分布:')
    console.log('=' .repeat(80))

    const typeResult = await client.query(`
      SELECT
        jsonb_object_keys(params) as key,
        COUNT(*) as count
      FROM products
      GROUP BY key
      ORDER BY count DESC
      LIMIT 20
    `)

    for (const row of typeResult.rows) {
      console.log(`   ${row.key}: 出现 ${row.count} 次`)
    }

  } catch (error) {
    console.error('❌ 检查数据时出错:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

checkData()
  .then(() => {
    console.log('\n✅ 数据检查完成')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 数据检查失败:', error)
    process.exit(1)
  })
