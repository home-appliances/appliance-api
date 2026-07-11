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
 * 从 name 字段中提取型号
 * 格式: 品牌 + 型号 (如: 格力KFR-26GW/(26543)FNhCe-B1(WIFI) -> KFR-26GW/(26543)FNhCe-B1(WIFI))
 */
function extractModelFromName(name: string): string | null {
  if (!name) return null

  // 尝试提取标准型号格式 (如 KFR-26GW, BCD-258WDPM)
  const standardMatch = name.match(/([A-Z]{2,3}-[0-9]+[A-Za-z0-9\/\-\(\)]*)/i)
  if (standardMatch) {
    return standardMatch[1]
  }

  // 尝试提取其他型号格式 (如 RF12WQ, FGR3.5pd)
  const otherMatch = name.match(/([A-Z]+[0-9]+[A-Za-z0-9\/\-\.\(\)]*)/i)
  if (otherMatch) {
    return otherMatch[1]
  }

  return null
}

async function fixMissingModel() {
  const client = await pool.connect()

  try {
    console.log('🚀 开始补充缺少型号的数据...')
    console.log('=' .repeat(80))
    console.log('')

    // 1. 获取缺少型号的记录
    const missingResult = await client.query(`
      SELECT id, name, params
      FROM products
      WHERE model IS NULL OR model = ''
    `)

    console.log(`📊 找到 ${missingResult.rows.length} 条缺少型号的记录\n`)

    let fixedCount = 0
    let failedCount = 0
    const fixedRecords: Array<{id: number, oldModel: string | null, newModel: string}> = []

    // 2. 处理每条记录
    for (const record of missingResult.rows) {
      try {
        let newModel: string | null = null

        // 首先从 params 中的 "型号(别称)" 获取
        if (record.params && record.params['型号(别称)']) {
          newModel = record.params['型号(别称)']
        }

        // 如果没有，从 name 中提取
        if (!newModel) {
          newModel = extractModelFromName(record.name)
        }

        // 如果还是没有，从 params 中的其他可能字段获取
        if (!newModel && record.params) {
          const possibleKeys = ['型号', '产品型号', 'model', 'Model']
          for (const key of possibleKeys) {
            if (record.params[key]) {
              newModel = record.params[key]
              break
            }
          }
        }

        if (newModel) {
          // 更新数据库
          await client.query(
            'UPDATE products SET model = $1, updated_at = NOW() WHERE id = $2',
            [newModel, record.id]
          )

          fixedRecords.push({
            id: record.id,
            oldModel: null,
            newModel: newModel
          })

          fixedCount++
          console.log(`   ✅ ID: ${record.id}, Name: ${record.name}`)
          console.log(`      新型号: ${newModel}`)
        } else {
          failedCount++
          console.log(`   ❌ ID: ${record.id}, Name: ${record.name}`)
          console.log(`      无法提取型号`)
        }
      } catch (error) {
        failedCount++
        console.error(`   ❌ 处理 ID: ${record.id} 时出错:`, error)
      }
    }

    // 3. 输出统计结果
    console.log('\n' + '=' .repeat(80))
    console.log('📊 补充型号完成统计:')
    console.log('=' .repeat(80))
    console.log(`   总记录数: ${missingResult.rows.length}`)
    console.log(`   成功补充: ${fixedCount}`)
    console.log(`   失败: ${failedCount}`)
    console.log('='.repeat(80))

    // 4. 验证结果
    console.log('\n🔍 验证补充结果...')
    const verifyResult = await client.query(`
      SELECT COUNT(*) as remaining
      FROM products
      WHERE model IS NULL OR model = ''
    `)
    const remaining = parseInt(verifyResult.rows[0].remaining)
    console.log(`   剩余缺少型号的记录: ${remaining}`)

    if (remaining === 0) {
      console.log('✅ 所有缺少型号的记录已补充完成！')
    } else {
      console.log(`   ⚠️ 还有 ${remaining} 条记录无法自动补充型号`)
    }

    // 5. 展示部分补充成功的记录
    console.log('\n📝 部分补充成功的记录:')
    console.log('-' .repeat(80))
    const displayRecords = fixedRecords.slice(0, 10)
    for (const record of displayRecords) {
      console.log(`   ID: ${record.id}, 新型号: ${record.newModel}`)
    }

    if (fixedRecords.length > 10) {
      console.log(`   ... 还有 ${fixedRecords.length - 10} 条记录`)
    }

  } catch (error) {
    console.error('❌ 补充型号过程中出错:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

fixMissingModel()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
