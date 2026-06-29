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

async function cleanShenmeshi() {
  const client = await pool.connect()

  try {
    console.log('🚀 开始清理 "什么是" 模式...\n')

    // 获取所有包含 "什么是" 的记录
    const records = await client.query(`
      SELECT id, params
      FROM products
      WHERE params::text LIKE '%什么是%'
    `)

    console.log(`需要处理 ${records.rows.length} 条记录\n`)

    let cleanedCount = 0

    for (const record of records.rows) {
      try {
        const params = record.params
        const cleanedParams: Record<string, any> = {}
        let hasChanges = false

        for (const [key, value] of Object.entries(params)) {
          if (typeof value === 'string' && value.includes('什么是')) {
            let cleanedValue = value

            // 清理 "• 什么是XXX" 模式（后面可能有品牌名）
            cleanedValue = cleanedValue.replace(/•\s*什么是[^,，。；\s]*(\([^)]*\))?/g, '')

            // 清理单独的 "• 什么是XXX" 模式
            cleanedValue = cleanedValue.replace(/•\s*什么是[^,，。；\s]*/g, '')

            // 清理开头的 "• " 或 " •"
            cleanedValue = cleanedValue.replace(/^\s*•\s*/, '').replace(/\s*•\s*$/, '')

            // 清理多余的空格
            cleanedValue = cleanedValue.replace(/\s+/g, ' ').trim()

            if (cleanedValue !== value) {
              hasChanges = true
              console.log(`   ID: ${record.id}, Key: ${key}`)
              console.log(`     原值: ${value}`)
              console.log(`     新值: ${cleanedValue}`)
              console.log('')
            }

            cleanedParams[key] = cleanedValue
          } else {
            cleanedParams[key] = value
          }
        }

        // 如果有修改，更新数据库
        if (hasChanges) {
          await client.query(
            'UPDATE products SET params = $1, updated_at = NOW() WHERE id = $2',
            [JSON.stringify(cleanedParams), record.id]
          )
          cleanedCount++
        }
      } catch (error) {
        console.error(`   ❌ 处理 ID: ${record.id} 时出错:`, error)
      }
    }

    console.log('\n' + '='.repeat(50))
    console.log('📊 清理 "什么是" 模式完成:')
    console.log('='.repeat(50))
    console.log(`   处理记录数: ${records.rows.length}`)
    console.log(`   成功清洗: ${cleanedCount}`)
    console.log('='.repeat(50))

    // 验证结果
    console.log('\n🔍 验证结果...')
    const verifyResult = await client.query(`
      SELECT COUNT(*) as remaining
      FROM products
      WHERE params::text LIKE '%什么是%'
    `)
    const remaining = parseInt(verifyResult.rows[0].remaining)
    console.log(`   剩余包含 "什么是" 的记录: ${remaining}`)

    if (remaining === 0) {
      console.log('✅ 所有 "什么是" 模式已清理完成！')
    }

  } catch (error) {
    console.error('❌ 清理过程中出错:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

cleanShenmeshi()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
