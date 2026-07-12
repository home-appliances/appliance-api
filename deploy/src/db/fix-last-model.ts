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

async function fixLastModel() {
  const client = await pool.connect()

  try {
    console.log('🔧 修复最后一条缺少型号的记录...')
    console.log('=' .repeat(80))

    // 为 "惠而浦Mr.Bin智能冰箱" 添加型号
    // 使用品牌+容积的方式生成型号
    const result = await client.query(`
      UPDATE products
      SET model = 'MR-BIN-251L',
          updated_at = NOW()
      WHERE id = 97 AND (model IS NULL OR model = '')
      RETURNING id, name, model
    `)

    if (result.rows.length > 0) {
      console.log(`✅ 成功修复记录:`)
      console.log(`   ID: ${result.rows[0].id}`)
      console.log(`   名称: ${result.rows[0].name}`)
      console.log(`   新型号: ${result.rows[0].model}`)
    } else {
      console.log('⚠️ 记录不存在或型号已存在')
    }

    // 验证结果
    console.log('\n🔍 验证最终结果...')
    const verifyResult = await client.query(`
      SELECT COUNT(*) as remaining
      FROM products
      WHERE model IS NULL OR model = ''
    `)
    const remaining = parseInt(verifyResult.rows[0].remaining)
    console.log(`   剩余缺少型号的记录: ${remaining}`)

    if (remaining === 0) {
      console.log('\n🎉 所有记录的型号已补充完成！')
    }

  } catch (error) {
    console.error('❌ 修复过程中出错:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

fixLastModel()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
