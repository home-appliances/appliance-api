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

async function finalClean() {
  const client = await pool.connect()

  try {
    console.log('🚀 开始最终清洗...\n')

    // 检查还有哪些无用文本模式
    const patterns = [
      { name: '是什么•', pattern: '%是什么•%' },
      { name: '有哪些•', pattern: '%有哪些•%' },
      { name: '的区别【', pattern: '%的区别【%' },
      { name: '有几种方式', pattern: '%有几种方式%' },
    ]

    console.log('📊 检查剩余的无用文本模式:')
    for (const p of patterns) {
      const result = await client.query(
        'SELECT COUNT(*) as count FROM products WHERE params::text LIKE $1',
        [p.pattern]
      )
      const count = parseInt(result.rows[0].count)
      console.log(`   "${p.name}": ${count} 条记录`)
    }

    // 获取所有记录进行深度清洗
    console.log('\n🔧 开始深度清洗...\n')

    const records = await client.query(`
      SELECT id, params
      FROM products
      WHERE params::text LIKE '%是什么•%'
         OR params::text LIKE '%有哪些•%'
         OR params::text LIKE '%的区别【%'
         OR params::text LIKE '%有几种方式%'
    `)

    console.log(`需要处理 ${records.rows.length} 条记录\n`)

    let cleanedCount = 0

    for (const record of records.rows) {
      try {
        const params = record.params
        const cleanedParams: Record<string, any> = {}
        let hasChanges = false

        for (const [key, value] of Object.entries(params)) {
          if (typeof value === 'string') {
            let cleanedValue = value

            // 清理 "• XXX是什么•" 模式
            cleanedValue = cleanedValue.replace(/•\s*[^,，。；\s]*是什么•?/g, '')

            // 清理 "• XXX有哪些•" 模式
            cleanedValue = cleanedValue.replace(/•\s*[^,，。；\s]*有哪些•?/g, '')

            // 清理 "• XXX的YYY有哪些•" 模式
            cleanedValue = cleanedValue.replace(/•\s*[^,，。；\s]*的[^,，。；\s]*有哪些•?/g, '')

            // 清理 "• XXX和YYY的区别【ZZZ】•" 模式
            cleanedValue = cleanedValue.replace(/•\s*[^,，。；\s]*和[^,，。；\s]*的区别【[^】]*】•?/g, '')

            // 清理 "• XXX都有几种方式•" 模式
            cleanedValue = cleanedValue.replace(/•\s*[^,，。；\s]*都有几种方式•?/g, '')

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
              console.log(`     原值: ${value.substring(0, 80)}`)
              console.log(`     新值: ${cleanedValue.substring(0, 80)}`)
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
    console.log('📊 最终清洗完成统计:')
    console.log('='.repeat(50))
    console.log(`   处理记录数: ${records.rows.length}`)
    console.log(`   成功清洗: ${cleanedCount}`)
    console.log('='.repeat(50))

    // 验证最终结果
    console.log('\n🔍 验证最终结果...')

    const verifyPatterns = [
      { name: '是什么•', pattern: '%是什么•%' },
      { name: '有哪些•', pattern: '%有哪些•%' },
      { name: '的区别【', pattern: '%的区别【%' },
      { name: '有几种方式', pattern: '%有几种方式%' },
      { name: '查看所有', pattern: '%查看所有%' },
      { name: '什么是', pattern: '%什么是%' },
    ]

    for (const p of verifyPatterns) {
      const result = await client.query(
        'SELECT COUNT(*) as count FROM products WHERE params::text LIKE $1',
        [p.pattern]
      )
      const count = parseInt(result.rows[0].count)
      if (count > 0) {
        console.log(`   ⚠️ "${p.name}": 仍有 ${count} 条记录`)
      }
    }

    console.log('\n✅ 最终清洗完成！')

  } catch (error) {
    console.error('❌ 清洗过程中出错:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

finalClean()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
