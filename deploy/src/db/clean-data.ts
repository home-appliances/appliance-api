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

/**
 * 清理 params 字段中的无用文本
 * 主要清理 "• XXX• 查看所有XXX" 这类推荐链接文本
 */
async function cleanParamsData() {
  const client = await pool.connect()

  try {
    console.log('🚀 开始清洗数据库中的无用数据...\n')

    // 1. 先统计有问题的数据数量
    console.log('📊 统计包含 "查看所有" 的数据...')
    const countResult = await client.query(`
      SELECT COUNT(*) as total
      FROM products
      WHERE params::text LIKE '%查看所有%'
    `)
    const totalCount = parseInt(countResult.rows[0].total)
    console.log(`   找到 ${totalCount} 条包含 "查看所有" 的记录\n`)

    if (totalCount === 0) {
      console.log('✅ 数据库中没有需要清洗的数据')
      return
    }

    // 2. 查看示例数据
    console.log('📝 示例数据（前3条）:')
    const sampleResult = await client.query(`
      SELECT id, params::text as params_text
      FROM products
      WHERE params::text LIKE '%查看所有%'
      LIMIT 3
    `)

    for (const row of sampleResult.rows) {
      const params = JSON.parse(row.params_text)
      const exampleKeys = Object.keys(params).slice(0, 3)
      console.log(`   ID: ${row.id}`)
      for (const key of exampleKeys) {
        if (params[key] && params[key].toString().includes('查看所有')) {
          console.log(`     ${key}: ${params[key].substring(0, 80)}...`)
        }
      }
      console.log('')
    }

    // 3. 开始清洗数据
    console.log('🔧 开始清洗数据...\n')

    // 获取所有需要清洗的记录
    const records = await client.query(`
      SELECT id, params
      FROM products
      WHERE params::text LIKE '%查看所有%'
    `)

    let cleanedCount = 0
    let errorCount = 0

    for (const record of records.rows) {
      try {
        const params = record.params
        const cleanedParams: Record<string, any> = {}
        let hasChanges = false

        for (const [key, value] of Object.entries(params)) {
          if (typeof value === 'string') {
            // 清理 "• XXX• 查看所有XXX" 模式
            // 匹配格式: • XXX• 查看所有XXX(品牌名) 或 &#8226; XXX&#8226; 查看所有XXX(品牌名)
            let cleanedValue = value

            // 处理 HTML 实体 &#8226; (•)
            cleanedValue = cleanedValue.replace(/&#8226;/g, '•')

            // 清理 "• 查看所有XXX" 模式（可能带有品牌名在括号中）
            cleanedValue = cleanedValue.replace(/•\s*查看所有[^,，。；\s]*(\([^)]*\))?/g, '')

            // 清理 "• 什么是XXX•" 模式
            cleanedValue = cleanedValue.replace(/•\s*什么是[^,，。；\s]*•/g, '')

            // 清理 "• XXX是什么•" 模式
            cleanedValue = cleanedValue.replace(/•\s*[^,，。；\s]*是什么•/g, '')

            // 清理 "• XXX有哪些•" 模式
            cleanedValue = cleanedValue.replace(/•\s*[^,，。；\s]*有哪些•/g, '')

            // 清理 "• XXX有哪些•" 模式（冰箱的制冷方式有哪些）
            cleanedValue = cleanedValue.replace(/•\s*[^,，。；\s]*的[^,，。；\s]*有哪些•/g, '')

            // 清理开头的 "• " 或 " •"
            cleanedValue = cleanedValue.replace(/^\s*•\s*/, '').replace(/\s*•\s*$/, '')

            // 清理多余的空格和标点
            cleanedValue = cleanedValue.replace(/\s+/g, ' ').trim()

            if (cleanedValue !== value) {
              hasChanges = true
              console.log(`   ID: ${record.id}, Key: ${key}`)
              console.log(`     原值: ${value.substring(0, 60)}...`)
              console.log(`     新值: ${cleanedValue.substring(0, 60)}...`)
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
        errorCount++
        console.error(`   ❌ 处理 ID: ${record.id} 时出错:`, error)
      }
    }

    // 4. 输出统计结果
    console.log('\n' + '='.repeat(50))
    console.log('📊 清洗完成统计:')
    console.log('='.repeat(50))
    console.log(`   总记录数: ${totalCount}`)
    console.log(`   成功清洗: ${cleanedCount}`)
    console.log(`   处理失败: ${errorCount}`)
    console.log('='.repeat(50))

    // 5. 验证清洗结果
    console.log('\n🔍 验证清洗结果...')
    const verifyResult = await client.query(`
      SELECT COUNT(*) as remaining
      FROM products
      WHERE params::text LIKE '%查看所有%'
    `)
    const remaining = parseInt(verifyResult.rows[0].remaining)
    console.log(`   剩余包含 "查看所有" 的记录: ${remaining}`)

    if (remaining === 0) {
      console.log('✅ 所有无用数据已成功清理！')
    } else {
      console.log(`   ⚠️ 还有 ${remaining} 条记录需要检查`)
    }

  } catch (error) {
    console.error('❌ 清洗过程中出错:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

// 执行清洗
cleanParamsData()
  .then(() => {
    console.log('\n🎉 数据清洗任务完成！')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 数据清洗任务失败:', error)
    process.exit(1)
  })
