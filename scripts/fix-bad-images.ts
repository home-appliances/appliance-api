/**
 * 修复无效占位图脚本
 *
 * 爬取 PConline/ZOL 产品页提取真实图片 URL → 下载 → 入库 → 更新 image_id
 *
 * 使用: tsx scripts/fix-bad-images.ts
 */
import { Pool } from 'pg'
import { config } from 'dotenv'
import { resolve } from 'path'
import { execSync } from 'child_process'

config({ path: resolve(import.meta.dirname, '../.env') })

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'appliance_db',
})

interface Product {
  id: number
  name: string
  source_url: string
}

// 从 PConline 产品页提取真实图片 URL
async function getPConlineImage(productId: number, sourceUrl: string): Promise<string | null> {
  try {
    // 使用 curl 绕过 PConline 对 Node.js fetch 的 503 屏蔽
    const html = execSync(
      `curl -s --max-time 10 -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" -H "Referer: https://www.pconline.com.cn/" "${sourceUrl}"`,
      { encoding: 'utf-8', timeout: 15000 }
    )

    // 查找 data-bigpic 属性（原图大图）
    const matches = html.match(/data-bigpic="([^"]+)"/g)
    if (matches && matches.length > 0) {
      // 提取第一个大图 URL（排除缩略图）
      for (const m of matches) {
        const url = m.match(/data-bigpic="([^"]+)"/)?.[1]
        if (!url) continue
        if (/_\d+x\d+\.(jpg|jpeg|png)$/i.test(url)) continue // 过滤缩略图
        return url.startsWith('//') ? `https:${url}` : url
      }
    }

    // 降级：从 img src 中提取第一个产品图片
    // 匹配 /images/product/{folder}/{pid}/{filename} 这样的路径
    const productImgRegex = /src="(https?:)?\/\/img\.pconline[^"]*\/images\/product\/\d+\/\d+\/(.+?)\.(jpg|jpeg|png)"/gi
    const seen = new Set<string>()
    for (const img of [...html.matchAll(productImgRegex)]) {
      const proto = img[1] || 'https:'
      const filepath = img[0].match(/\/images\/product\/\d+\/\d+\/.+?\.(jpg|jpeg|png)/)?.[0]
      if (!filepath) continue

      // 去掉缩略图尺寸后缀（_120x90, _q, _z 等）
      const cleanPath = filepath.replace(/_[a-z]_\d+x\d+\.(jpg|jpeg|png)$/i, '.$1')
                                .replace(/_\d+x\d+\.(jpg|jpeg|png)$/i, '.$1')
                                .replace(/_[a-z]\.(jpg|jpeg|png)$/i, '.$1')
      const fullUrl = `${proto}//img.pconline.com.cn${cleanPath}`

      // 去重、排除频道装饰图和无关图
      if (seen.has(fullUrl)) continue
      seen.add(fullUrl)
      if (fullUrl.includes('channel') || fullUrl.includes('logo') || fullUrl.includes('banner')) continue
      if (/_\d+x\d+\.(jpg|jpeg|png)$/i.test(fullUrl)) continue

      // 验证图片真实存在
      try {
        const check = await fetch(fullUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) })
        if (check.ok && (check.headers.get('content-length') || '0') !== '27') {
          return fullUrl
        }
      } catch {}
    }

    // 再降级：尝试路径模式
    for (const divisor of [1000, 100]) {
      const folder = Math.floor(productId / divisor)
      const fallback = `http://img.pconline.com.cn/images/product/${folder}/${productId}/1.jpg`
      try {
        const check = await fetch(fallback, { method: 'HEAD', signal: AbortSignal.timeout(3000) })
        if (check.ok && check.headers.get('content-length') !== '27') return fallback
      } catch {}
    }
    return null
  } catch (e) {
    console.error(`  ⚠ PConline 爬取失败: ${(e as Error).message}`)
    return null
  }
}

// 从 ZOL 产品页提取真实图片 URL
async function getZOLImage(sourceUrl: string): Promise<string | null> {
  try {
    const html = execSync(
      `curl -s --max-time 10 -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" -H "Referer: http://www.zol.com.cn/" "${sourceUrl}"`,
      { encoding: 'utf-8', timeout: 15000 }
    )

    // 查找 productImg / bigimg / 等 ZOL 图片格式
    const patterns = [
      /"productImg"\s*:\s*"([^"]+)"/,
      /"bigimg"\s*:\s*"([^"]+)"/,
    ]

    for (const pat of patterns) {
      const m = html.match(pat)
      if (m && m[1]) {
        let url = m[1]
        if (url.startsWith('//')) url = `https:${url}`
        if (url) return url
      }
    }

    // 降级：查找所有 img 标签中的 ZOL 图片
    const imgRegex = /<img[^>]+src="(https?:\/\/[^"]*(?:zol|zol-img)[^"]*\.(?:jpg|jpeg|png))"[^>]*>/gi
    const allImgs = [...html.matchAll(imgRegex)]
    for (const img of allImgs) {
      const url = img[1]
      // 排除占位图
      if (url.includes('no_pic') || url.includes('blank')) continue
      if (url) return url
    }

    return null
  } catch (e) {
    console.error(`  ⚠ ZOL 爬取失败: ${(e as Error).message}`)
    return null
  }
}

// 下载图片并存储到数据库，返回 image_id
async function downloadAndStore(imgUrl: string, product: Product): Promise<number | null> {
  try {
    const resp = await fetch(imgUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': product.source_url,
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!resp.ok) {
      console.error(`  ⚠ 下载失败 HTTP ${resp.status}: ${imgUrl}`)
      return null
    }

    const buffer = Buffer.from(await resp.arrayBuffer())
    // 检查 image_data 是否足够大（排除占位图）
    if (buffer.length < 1024) {
      console.error(`  ⚠ 图片过小 (${buffer.length} 字节): ${imgUrl}`)
      return null
    }

    // 检测 MIME
    const contentType = resp.headers.get('content-type') || 'image/jpeg'
    const mimeType = contentType.startsWith('image/') ? contentType.split(';')[0].trim() : 'image/jpeg'

    // 检查 source_url 是否已存在（避免唯一约束冲突）
    const exist = await pool.query('SELECT id FROM images WHERE source_url = $1', [imgUrl])
    if (exist.rows.length > 0) {
      console.log(`  ℹ 图片已存在, 复用 image_id: ${exist.rows[0].id}`)
      return exist.rows[0].id
    }

    // 存入 images 表
    const result = await pool.query(
      `INSERT INTO images (image_data, mime_type, file_size, source_url, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id`,
      [buffer, mimeType, buffer.length, imgUrl]
    )

    return result.rows[0].id
  } catch (e) {
    console.error(`  ⚠ 下载/入库失败: ${(e as Error).message}`)
    return null
  }
}

async function main() {
  // 1. 查出所有无图片的产品（之前清理过的 118 个）
  const products = await pool.query<Product>(
    `SELECT id, name, source_url FROM products
     WHERE image_id IS NULL AND source_url IS NOT NULL
     ORDER BY id`
  )

  console.log(`📋 共 ${products.rows.length} 个产品需要修复图片\n`)

  let fixed = 0
  let failed = 0

  for (const product of products.rows) {
    const name = (product.name || '').slice(0, 30)
    console.log(`\n[${product.id}] ${name}`)
    console.log(`  来源: ${product.source_url}`)

    let imgUrl: string | null = null

    // 根据域名选择爬取策略
    if (product.source_url.includes('pconline.com.cn')) {
      const match = product.source_url.match(/product\.pconline\.com\.cn\/[^/]+\/[^/]+\/(\d+)\.html/)
      if (match) {
        const pid = parseInt(match[1])
        imgUrl = await getPConlineImage(pid, product.source_url)
      }
    } else if (product.source_url.includes('zol.com.cn')) {
      imgUrl = await getZOLImage(product.source_url)
    }

    if (!imgUrl) {
      console.log(`  ❌ 未找到真实图片`)
      failed++
      continue
    }

    console.log(`  📷 真实图片: ${imgUrl.slice(0, 100)}`)

    // 下载并入库
    const newImageId = await downloadAndStore(imgUrl, product)
    if (!newImageId) {
      console.log(`  ❌ 下载/入库失败`)
      failed++
      continue
    }

    // 更新产品
    await pool.query('UPDATE products SET image_id = $1 WHERE id = $2', [newImageId, product.id])
    console.log(`  ✅ 已修复 → image_id: ${newImageId}`)
    fixed++
  }

  console.log(`\n═══════════════════════════════`)
  console.log(`修复完成: ${fixed} 成功, ${failed} 失败 / 共 ${products.rows.length}`)

  await pool.end()
}

main().catch(e => { console.error('脚本异常:', e); process.exit(1) })
