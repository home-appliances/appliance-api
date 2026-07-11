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

async function deduplicate() {
  const client = await pool.connect()

  try {
    console.log('🚀 开始数据去重...')
    console.log('=' .repeat(100))
    console.log('')

    // 1. 查找名称完全相同的重复记录
    console.log('📊 1. 查找名称重复的记录')
    console.log('-' .repeat(100))

    const duplicateGroups = await client.query(`
      SELECT name, array_agg(id) as ids, COUNT(*) as count
      FROM products
      GROUP BY name
      HAVING COUNT(*) > 1
    `)

    console.log(`找到 ${duplicateGroups.rows.length} 组重复记录\n`)

    let totalDeleted = 0

    for (const group of duplicateGroups.rows) {
      console.log(`名称: "${group.name}" (${group.count} 条)`)

      // 获取这些记录的详细信息
      const records = await client.query(`
        SELECT id, params, source_url, created_at
        FROM products
        WHERE id = ANY($1)
        ORDER BY created_at DESC
      `, [group.ids])

      // 比较参数是否完全相同
      const paramsList = records.rows.map(r => JSON.stringify(r.params))
      const uniqueParams = [...new Set(paramsList)]

      if (uniqueParams.length === 1) {
        // 参数完全相同，只保留最新的一条
        const keepRecord = records.rows[0] // 最新的
        const deleteRecords = records.rows.slice(1) // 需要删除的

        console.log(`   ✅ 参数完全相同，保留最新记录 (ID: ${keepRecord.id})`)

        for (const record of deleteRecords) {
          console.log(`   🗑️  删除记录 (ID: ${record.id}, 创建时间: ${record.created_at})`)

          await client.query('DELETE FROM products WHERE id = $1', [record.id])
          totalDeleted++
        }
      } else {
        // 参数不同，保留所有记录
        console.log(`   ⚠️ 参数不同，保留所有记录`)
        for (const record of records.rows) {
          console.log(`     - ID: ${record.id}, 创建时间: ${record.created_at}`)
        }
      }
      console.log('')
    }

    // 2. 验证结果
    console.log('\n📊 2. 验证去重结果')
    console.log('-' .repeat(100))

    const remainingDuplicates = await client.query(`
      SELECT COUNT(*) as count
      FROM (
        SELECT name
        FROM products
        GROUP BY name
        HAVING COUNT(*) > 1
      ) as dup
    `)

    console.log(`剩余重复记录组数: ${remainingDuplicates.rows[0].count}`)

    // 3. 统计
    console.log('\n📊 3. 去重统计')
    console.log('-' .repeat(100))

    const totalCount = await client.query('SELECT COUNT(*) as count FROM products')
    console.log(`去重前: ${parseInt(totalCount.rows[0].count) + totalDeleted} 条`)
    console.log(`删除: ${totalDeleted} 条`)
    console.log(`去重后: ${totalCount.rows[0].count} 条`)

    if (parseInt(remainingDuplicates.rows[0].count) === 0) {
      console.log('\n🎉 去重完成！没有剩余的重复记录')
    } else {
      console.log('\n⚠️ 还有重复记录，但参数不同，已保留')
    }

    console.log('\n' + '=' .repeat(100))

  } catch (error) {
    console.error('❌ 去重过程中出错:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

deduplicate()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
