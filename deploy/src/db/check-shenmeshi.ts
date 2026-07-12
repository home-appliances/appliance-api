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

async function checkShenmeshi() {
  const client = await pool.connect()

  try {
    console.log('🔍 检查包含 "什么是" 的数据...\n')

    const records = await client.query(`
      SELECT id, name, params
      FROM products
      WHERE params::text LIKE '%什么是%'
      LIMIT 5
    `)

    console.log(`找到 ${records.rows.length} 条记录:\n`)

    for (const record of records.rows) {
      console.log(`ID: ${record.id}, Name: ${record.name}`)
      const params = record.params

      for (const [key, value] of Object.entries(params)) {
        if (typeof value === 'string' && value.includes('什么是')) {
          console.log(`  ${key}: ${value}`)
        }
      }
      console.log('')
    }

    // 检查 "什么是" 的不同模式
    console.log('\n📊 "什么是" 的不同模式:')
    console.log('=' .repeat(80))

    const patterns = [
      { name: '什么是XXX•', pattern: '%什么是XXX•%' },
      { name: '什么是XXX（', pattern: '%什么是XXX（%' },
      { name: '什么是能效等级', pattern: '%什么是能效等级%' },
      { name: '什么是LED', pattern: '%什么是LED%' },
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

    // 查看具体的 "什么是" 内容
    console.log('\n📝 具体的 "什么是" 内容样本:')
    console.log('=' .repeat(80))

    const samples = await client.query(`
      SELECT DISTINCT
        (jsonb_each_text(params)).value as value
      FROM products
      WHERE params::text LIKE '%什么是%'
      LIMIT 10
    `)

    for (const row of samples.rows) {
      if (row.value && row.value.includes('什么是')) {
        console.log(`   ${row.value.substring(0, 100)}`)
      }
    }

  } catch (error) {
    console.error('❌ 检查失败:', error)
  } finally {
    client.release()
    await pool.end()
  }
}

checkShenmeshi()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
