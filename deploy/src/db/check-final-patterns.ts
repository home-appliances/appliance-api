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

async function checkFinalPatterns() {
  const client = await pool.connect()

  try {
    console.log('🔍 检查剩余的无用文本模式...\n')

    // 查看 "有哪些" 的内容
    console.log('📝 "有哪些" 的内容样本:')
    console.log('=' .repeat(80))

    const samples = await client.query(`
      SELECT
        (jsonb_each_text(params)).value as value
      FROM products
      WHERE params::text LIKE '%有哪些%'
      LIMIT 5
    `)

    for (const row of samples.rows) {
      if (row.value && row.value.includes('有哪些')) {
        console.log(`   "${row.value}"`)
      }
    }

    // 查看 "是什么" 的内容
    console.log('\n📝 "是什么" 的内容样本:')
    console.log('=' .repeat(80))

    const samples2 = await client.query(`
      SELECT
        (jsonb_each_text(params)).value as value
      FROM products
      WHERE params::text LIKE '%是什么%'
      LIMIT 5
    `)

    for (const row of samples2.rows) {
      if (row.value && row.value.includes('是什么')) {
        console.log(`   "${row.value}"`)
      }
    }

    // 检查这些是否是正常的参数值
    console.log('\n📊 检查这些是否是正常的参数值:')
    console.log('=' .repeat(80))

    const patterns = [
      { name: '有哪些', pattern: '%有哪些%' },
      { name: '是什么', pattern: '%是什么%' },
    ]

    for (const p of patterns) {
      const result = await client.query(`
        SELECT COUNT(DISTINCT (jsonb_each_text(params)).value) as unique_values
        FROM products
        WHERE params::text LIKE $1
      `, [p.pattern])
      console.log(`   "${p.name}": ${result.rows[0].unique_values} 个不同的值`)
    }

  } catch (error) {
    console.error('❌ 检查失败:', error)
  } finally {
    client.release()
    await pool.end()
  }
}

checkFinalPatterns()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
