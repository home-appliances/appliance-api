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

async function checkFailed() {
  const client = await pool.connect()

  try {
    console.log('🔍 检查无法补充型号的记录...')
    console.log('=' .repeat(80))

    const result = await client.query(`
      SELECT id, name, brand, category, params
      FROM products
      WHERE model IS NULL OR model = ''
    `)

    console.log(`找到 ${result.rows.length} 条记录:\n`)

    for (const row of result.rows) {
      console.log(`ID: ${row.id}`)
      console.log(`名称: ${row.name}`)
      console.log(`品牌: ${row.brand}`)
      console.log(`类别: ${row.category}`)
      console.log(`参数: ${JSON.stringify(row.params, null, 2)}`)
      console.log('')
    }

  } catch (error) {
    console.error('❌ 检查失败:', error)
  } finally {
    client.release()
    await pool.end()
  }
}

checkFailed()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
