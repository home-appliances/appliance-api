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

async function verifyData() {
  const client = await pool.connect()

  try {
    console.log('🔍 数据验证和对比分析报告')
    console.log('=' .repeat(80))
    console.log('')

    // 1. 基本统计
    console.log('📊 1. 数据库基本统计')
    console.log('-' .repeat(80))

    const totalResult = await client.query('SELECT COUNT(*) as total FROM products')
    console.log(`   总产品数: ${totalResult.rows[0].total}`)

    // 按品牌统计
    console.log('\n   按品牌统计:')
    const brandResult = await client.query(`
      SELECT brand, COUNT(*) as count
      FROM products
      WHERE brand IS NOT NULL
      GROUP BY brand
      ORDER BY count DESC
      LIMIT 10
    `)
    for (const row of brandResult.rows) {
      console.log(`     ${row.brand}: ${row.count} 条`)
    }

    // 按类别统计
    console.log('\n   按类别统计:')
    const categoryResult = await client.query(`
      SELECT category, COUNT(*) as count
      FROM products
      WHERE category IS NOT NULL
      GROUP BY category
      ORDER BY count DESC
    `)
    for (const row of categoryResult.rows) {
      console.log(`     ${row.category}: ${row.count} 条`)
    }

    // 2. 数据完整性检查
    console.log('\n\n📊 2. 数据完整性检查')
    console.log('-' .repeat(80))

    // 检查必填字段
    const nullCheck = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN name IS NULL THEN 1 END) as null_name,
        COUNT(CASE WHEN brand IS NULL THEN 1 END) as null_brand,
        COUNT(CASE WHEN category IS NULL THEN 1 END) as null_category,
        COUNT(CASE WHEN model IS NULL THEN 1 END) as null_model,
        COUNT(CASE WHEN params IS NULL THEN 1 END) as null_params,
        COUNT(CASE WHEN source_url IS NULL THEN 1 END) as null_source_url
      FROM products
    `)

    const stats = nullCheck.rows[0]
    console.log(`   总记录数: ${stats.total}`)
    console.log(`   缺少 name: ${stats.null_name} 条 ${stats.null_name > 0 ? '⚠️' : '✅'}`)
    console.log(`   缺少 brand: ${stats.null_brand} 条 ${stats.null_brand > 0 ? '⚠️' : '✅'}`)
    console.log(`   缺少 category: ${stats.null_category} 条 ${stats.null_category > 0 ? '⚠️' : '✅'}`)
    console.log(`   缺少 model: ${stats.null_model} 条 ${stats.null_model > 0 ? '⚠️' : '✅'}`)
    console.log(`   缺少 params: ${stats.null_params} 条 ${stats.null_params > 0 ? '⚠️' : '✅'}`)
    console.log(`   缺少 source_url: ${stats.null_source_url} 条 ${stats.null_source_url > 0 ? '⚠️' : '✅'}`)

    // 3. 参数质量检查
    console.log('\n\n📊 3. 参数质量检查')
    console.log('-' .repeat(80))

    // 检查 params 中的键数量分布（通过计算字符串长度估算）
    console.log('   params 字段大小分布:')
    const keyCountResult = await client.query(`
      SELECT
        CASE
          WHEN LENGTH(params::text) < 200 THEN '小 (0-200字符)'
          WHEN LENGTH(params::text) < 500 THEN '中 (200-500字符)'
          WHEN LENGTH(params::text) < 1000 THEN '大 (500-1000字符)'
          ELSE '超大 (1000+字符)'
        END as size_range,
        COUNT(*) as count
      FROM products
      GROUP BY size_range
      ORDER BY MIN(LENGTH(params::text))
    `)

    for (const row of keyCountResult.rows) {
      console.log(`     ${row.key_range}: ${row.count} 条`)
    }

    // 检查常见参数的覆盖情况
    console.log('\n   常见参数覆盖率:')
    const commonParams = ['型号', '重量', '制冷剂', '压缩机', '总容积', '显示屏', '产品类别', '制冷方式', '能耗等级']
    for (const param of commonParams) {
      const result = await client.query(`
        SELECT COUNT(*) as count
        FROM products
        WHERE params ? $1
      `, [param])
      const percentage = ((parseInt(result.rows[0].count) / parseInt(stats.total)) * 100).toFixed(1)
      console.log(`     ${param}: ${result.rows[0].count} 条 (${percentage}%)`)
    }

    // 4. 数据来源检查
    console.log('\n\n📊 4. 数据来源检查')
    console.log('-' .repeat(80))

    // 检查 source_url 唯一性
    const duplicateUrlResult = await client.query(`
      SELECT source_url, COUNT(*) as count
      FROM products
      GROUP BY source_url
      HAVING COUNT(*) > 1
      LIMIT 5
    `)

    if (duplicateUrlResult.rows.length > 0) {
      console.log('   ⚠️ 发现重复的 source_url:')
      for (const row of duplicateUrlResult.rows) {
        console.log(`     ${row.source_url}: ${row.count} 条`)
      }
    } else {
      console.log('   ✅ 没有重复的 source_url')
    }

    // 检查数据来源分布
    console.log('\n   数据来源平台分布:')
    const platformResult = await client.query(`
      SELECT source_platform, COUNT(*) as count
      FROM products
      WHERE source_platform IS NOT NULL
      GROUP BY source_platform
    `)

    if (platformResult.rows.length > 0) {
      for (const row of platformResult.rows) {
        console.log(`     ${row.source_platform}: ${row.count} 条`)
      }
    } else {
      console.log('     没有记录 source_platform')
    }

    // 5. 数据异常检查
    console.log('\n\n📊 5. 数据异常检查')
    console.log('-' .repeat(80))

    // 检查参数值长度异常
    console.log('   检查参数值长度异常（超过100字符的值）:')
    const longValueResult = await client.query(`
      SELECT id, name, params::text as params_text
      FROM products
      WHERE LENGTH(params::text) > 2000
      LIMIT 5
    `)

    if (longValueResult.rows.length > 0) {
      console.log('   ⚠️ 发现异常长的参数值:')
      for (const row of longValueResult.rows) {
        console.log(`     ID: ${row.id}, ${row.param_key}: ${row.param_value.substring(0, 50)}...`)
      }
    } else {
      console.log('   ✅ 没有发现异常长的参数值')
    }

    // 检查空值或空白值
    console.log('\n   检查参数中的空值或空白值:')
    const emptyValueResult = await client.query(`
      SELECT COUNT(*) as count
      FROM products
      WHERE params::text LIKE '%""%' OR params::text LIKE '%: ""%'
    `)
    console.log(`   ${emptyValueResult.rows[0].count} 条记录包含空值 ${parseInt(emptyValueResult.rows[0].count) > 0 ? '⚠️' : '✅'}`)

    // 6. 样本数据展示
    console.log('\n\n📊 6. 样本数据展示（每类1条）')
    console.log('-' .repeat(80))

    const sampleResult = await client.query(`
      SELECT id, name, brand, category, params
      FROM products
      WHERE params IS NOT NULL
      LIMIT 3
    `)

    for (const row of sampleResult.rows) {
      console.log(`\n   ID: ${row.id}`)
      console.log(`   名称: ${row.name}`)
      console.log(`   品牌: ${row.brand}`)
      console.log(`   类别: ${row.category}`)
      console.log(`   参数: ${JSON.stringify(row.params, null, 2).substring(0, 200)}...`)
    }

    // 7. 总结
    console.log('\n\n' + '=' .repeat(80))
    console.log('📊 验证总结')
    console.log('=' .repeat(80))
    console.log(`✅ 总数据量: ${stats.total} 条`)
    console.log(`✅ 数据完整性: 缺失字段已标记`)
    console.log(`✅ 参数质量: 已检查常见参数覆盖率`)
    console.log(`✅ 数据来源: 已检查来源分布`)
    console.log(`✅ 数据异常: 已检查异常值`)
    console.log('=' .repeat(80))

  } catch (error) {
    console.error('❌ 验证过程中出错:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

verifyData()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
