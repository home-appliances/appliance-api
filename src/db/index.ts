/**
 * 数据库连接模块
 * 连接 PostgreSQL，提供数据查询接口
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// =====================================================
// HTML 实体解码（处理历史数据）
// =====================================================
function decodeHtmlEntities(text: string): string {
  if (!text || typeof text !== 'string') return text;

  let decoded = text;

  // 解码 &#xxx; 格式的数字实体
  decoded = decoded.replace(/&#(\d+);/g, (_, num) => {
    return String.fromCharCode(parseInt(num, 10));
  });

  // 解码 &#xHH; 格式的十六进制实体
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });

  // 替换命名实体
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&bull;': '•',
    '&middot;': '·',
    '&nbsp;': ' ',
  };

  Object.entries(entities).forEach(([entity, char]) => {
    decoded = decoded.replace(new RegExp(entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), char);
  });

  return decoded;
}

// 递归解码对象中所有字符串值
function decodeObjectStrings(obj: any): any {
  if (typeof obj === 'string') {
    return cleanParamValue(decodeHtmlEntities(obj));
  }
  if (Array.isArray(obj)) {
    return obj.map(decodeObjectStrings);
  }
  if (obj && typeof obj === 'object') {
    const decoded: any = {};
    for (const [key, value] of Object.entries(obj)) {
      decoded[key] = decodeObjectStrings(value);
    }
    return decoded;
  }
  return obj;
}

// =====================================================
// 清理参数值（去掉冗余说明文字）
// =====================================================
function cleanParamValue(value: string): string {
  if (!value) return value;

  // 能效等级：只保留"X级"或"一级能效"等核心词
  // 例如："三级• 什么是能效等级 • 查看所有三级小米" → "三级"
  if (value.includes('能效等级')) {
    const match = value.match(/(一级|二级|三级|四级|五级|六级)/);
    return match ? match[1] : value.split('•')[0].split('·')[0].trim();
  }

  // 制冷方式：只保留"XX式"
  // 例如："风冷式• 冰箱的制冷方式有哪些 • 查看所有风冷式小米" → "风冷式"
  if (value.includes('制冷方式') || value.includes('风冷') || value.includes('直冷')) {
    const match = value.match(/(风冷式|直冷式|风直冷混合式|间冷式|直冷式)/);
    return match ? match[1] : value.split('•')[0].split('·')[0].trim();
  }

  // 通用清理：如果有•或·分隔符，只取第一段
  if (value.includes('•') || value.includes('·')) {
    return value.split('•')[0].split('·')[0].trim();
  }

  return value;
}

export const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'appliance_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres123',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('数据库连接池错误:', err);
});

// =====================================================
// 品牌中文名 → 英文名映射
// =====================================================
const brandNameMap: Record<string, string> = {
  // 通用品牌
  '小米': 'xiaomi', '海尔': 'haier', '美的': 'midea', '松下': 'panasonic',
  '西门子': 'siemens', '三星': 'samsung', '海信': 'hisense', '容声': 'rongsheng',
  '卡萨帝': 'casarte', '伊莱克斯': 'electrolux', '惠而浦': 'whirlpool',
  '博世': 'bocsh', 'TCL': 'tcl', '志高': 'chigo', '新飞': 'xinfei',
  '三菱': 'mitsubishi', '奥克斯': 'aux', 'LG': 'lg',
  // 空调品牌
  '格力': 'gree', '大金': 'daikin', '科龙': 'kelon',
  // 洗衣机品牌
  '小天鹅': 'little_swan',
  // 热水器品牌
  '林内': 'noritz', '能率': 'noritz', 'A.O.史密斯': 'a/o_smith', '史密斯': 'a/o_smith',
  '万和': 'macro', '万家乐': 'macro', '阿里斯顿': 'ariston',
  // 电视品牌
  '索尼': 'sony', '夏普': 'sharp', '飞利浦': 'philips', '长虹': 'changhong',
  '康佳': 'konka', '乐视': 'letv', '华为': 'huawei',
  // 厨电品牌
  '老板': 'robam', '方太': 'fotile', '华帝': 'vatti',
};

// 反向映射：英文品牌名 → 中文品牌名
const brandEnglishToChinese: Record<string, string> = {};
Object.entries(brandNameMap).forEach(([cn, en]) => {
  brandEnglishToChinese[en] = cn;
});

// =====================================================
// 搜索关键词处理：将用户输入转换为 tsquery
// =====================================================
function formatSearchQuery(keyword: string): string {
  // 移除特殊字符，保留中文、英文、数字
  const cleaned = keyword.replace(/[^一-龥a-zA-Z0-9]/g, ' ').trim();
  if (!cleaned) return '';

  // 将空格分隔的词提取出来
  const terms = cleaned.split(/\s+/).filter(t => t.length > 0);
  if (terms.length === 0) return '';

  // 将数字和字母单位分离（如 215L → 215 和 L）
  const expandedTerms: string[] = [];
  for (const term of terms) {
    const match = term.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z一-龥]+)$/);
    if (match) {
      expandedTerms.push(match[1]);
      if (match[2].length > 0) {
        expandedTerms.push(match[2]);
      }
    } else {
      expandedTerms.push(term);
    }
  }

  return expandedTerms.join(' | ');
}

// =====================================================
// 搜索词拆分（全文 / ILIKE / 日志 / 高亮共用）
// =====================================================
function splitSearchTerm(t: string): string[] {
  if (!t) return [];
  const segments = t.match(/[一-龥]+|[a-zA-Z0-9.\-]+/g) || [t];
  const result: string[] = [];
  for (const seg of segments) {
    if (/[一-龥]/.test(seg) && seg.length > 2) {
      for (let i = 0; i < seg.length; i += 2) {
        result.push(seg.substring(i, i + 2));
      }
    } else {
      result.push(seg);
    }
  }
  return result;
}

/** 用户输入 → 空格分词后的原始词 */
function extractSearchTerms(keyword: string): string[] {
  const cleaned = keyword.replace(/[^一-龥a-zA-Z0-9.\-]/g, ' ').trim();
  return cleaned.split(/\s+/).filter((t) => t.length > 0);
}

/** 拆成检索用 chunk（去重） */
function buildSearchChunks(terms: string[]): string[] {
  return [...new Set(terms.flatMap((t) => splitSearchTerm(t)).filter(Boolean))];
}

/** 构建 tsquery：多词 AND，英文/数字前缀匹配 */
function buildTsQuery(terms: string[]): string {
  const parts: string[] = [];
  for (const t of terms) {
    if (/^[a-zA-Z]+$/.test(t)) {
      parts.push(`${t.toLowerCase()}:*`);
    } else if (/^[0-9.]+[a-zA-Z一-龥]+$/.test(t)) {
      parts.push(`${t}:*`);
    } else {
      for (const c of splitSearchTerm(t)) {
        parts.push(`${c}:*`);
      }
    }
  }
  return parts.join(' & ');
}

const PRODUCT_LIST_COLS = `
  p.id, p.name, p.brand, p.model, p.price, p.rating, p.review_count,
  p.params, p.category_id, p.pinyin, p.main_image, p.created_at,
  c.name AS category_name, c.code AS category
`;

// =====================================================
// 高亮处理：在文本中包裹 <hl> 标签
// =====================================================
function highlightText(text: string, keyword: string): string {
  if (!text || !keyword) return text || '';

  const terms = extractSearchTerms(keyword);
  if (terms.length === 0) return text;

  const allTerms = buildSearchChunks(terms).filter((t) => t.length > 0);
  allTerms.sort((a, b) => b.length - a.length);

  let result = text;
  for (const term of allTerms) {
    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    result = result.replace(regex, `<hl>$&</hl>`);
  }

  return result;
}

function mapSearchRows(rows: any[], keyword: string) {
  return decodeObjectStrings(rows).map((p) => ({
    ...p,
    title: highlightText(p.name, keyword),
    img: p.main_image || '',
  }));
}

// =====================================================
// 搜索产品：先加权全文，无命中再 ILIKE 降级（含 params_search_text）
// =====================================================
export async function searchProducts(
  keyword: string,
  page: number = 1,
  limit: number = 20
): Promise<{
  products: any[];
  total: number;
  page: number;
  limit: number;
}> {
  const offset = (page - 1) * limit;

  if (!keyword || !keyword.trim()) {
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM products WHERE deleted_at IS NULL'
    );
    const total = parseInt(countResult.rows[0].count);
    const result = await pool.query(
      `SELECT p.id, p.name, p.brand, p.model, p.price, p.rating, p.review_count, p.params,
              p.category_id, p.pinyin, p.main_image, p.created_at,
              c.name AS category_name, c.code AS category
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.deleted_at IS NULL
       ORDER BY p.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return {
      products: decodeObjectStrings(result.rows),
      total,
      page,
      limit,
    };
  }

  const terms = extractSearchTerms(keyword);
  if (terms.length === 0) {
    return { products: [], total: 0, page, limit };
  }

  const tsQuery = buildTsQuery(terms);
  const chunks = buildSearchChunks(terms);
  console.log('搜索调试:', { keyword, terms, tsQuery, chunks });

  // ---------- Phase 1: 仅 FTS（可用 GIN，不与 ILIKE OR 绑死）----------
  const ftsSql = `
    SELECT ${PRODUCT_LIST_COLS},
      ts_rank_cd(p.search_vector, q.query) AS rank,
      COUNT(*) OVER()::int AS total_count
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    CROSS JOIN (SELECT to_tsquery('jiebacfg', $1) AS query) q
    WHERE p.deleted_at IS NULL
      AND p.search_vector @@ q.query
    ORDER BY rank DESC, p.created_at DESC
    LIMIT $2 OFFSET $3
  `;

  const ftsResult = await pool.query(ftsSql, [tsQuery, limit, offset]);
  const ftsTotal = ftsResult.rows[0]?.total_count ?? 0;

  if (ftsTotal > 0) {
    return {
      products: mapSearchRows(ftsResult.rows, keyword),
      total: ftsTotal,
      page,
      limit,
    };
  }

  // ---------- Phase 2: ILIKE 降级（含参数值文本）----------
  if (chunks.length === 0) {
    return { products: [], total: 0, page, limit };
  }

  const ilikeParams = chunks.map((t) => `%${t}%`);
  const perTermConds = ilikeParams.map((_, i) => {
    const idx = i + 1;
    return `(p.name ILIKE $${idx} OR p.brand ILIKE $${idx} OR p.model ILIKE $${idx}
      OR p.pinyin ILIKE $${idx} OR COALESCE(p.params_search_text, '') ILIKE $${idx}
      OR c.name ILIKE $${idx})`;
  });
  const ilikeCond = perTermConds.join(' AND ');
  const limitIdx = ilikeParams.length + 1;
  const offsetIdx = limitIdx + 1;

  const ilikeSql = `
    SELECT ${PRODUCT_LIST_COLS},
      0::float AS rank,
      COUNT(*) OVER()::int AS total_count
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.deleted_at IS NULL AND (${ilikeCond})
    ORDER BY
      CASE
        WHEN p.name ILIKE $1 THEN 3
        WHEN p.brand ILIKE $1 THEN 2
        ELSE 1
      END DESC,
      p.created_at DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const ilikeResult = await pool.query(ilikeSql, [...ilikeParams, limit, offset]);
  const ilikeTotal = ilikeResult.rows[0]?.total_count ?? 0;

  return {
    products: mapSearchRows(ilikeResult.rows, keyword),
    total: ilikeTotal,
    page,
    limit,
  };
}

// =====================================================
// 获取产品详情
// =====================================================
export async function getProductById(id: number): Promise<any | null> {
  const result = await pool.query('SELECT * FROM products WHERE id = $1 AND deleted_at IS NULL', [id]);
  return result.rows[0] ? decodeObjectStrings(result.rows[0]) : null;
}

// =====================================================
// 按品牌获取产品
// =====================================================
export async function getProductsByBrand(brand: string): Promise<any[]> {
  const result = await pool.query(
    'SELECT * FROM products WHERE brand = $1 ORDER BY created_at DESC',
    [brand]
  );
  return result.rows;
}

// =====================================================
// 获取品牌列表
// =====================================================
export async function getBrands(): Promise<Array<{ brand: string; count: number }>> {
  const result = await pool.query(`
    SELECT brand, COUNT(*) as count
    FROM products
    GROUP BY brand
    ORDER BY count DESC
  `);
  return result.rows;
}

// =====================================================
// 获取产品参数（平铺版：所有参数一级键值对）
// =====================================================
export async function getProductParams(id: number): Promise<Record<string, string> | null> {
  const result = await pool.query('SELECT params FROM products WHERE id = $1', [id]);

  if (result.rows.length === 0) {
    return null;
  }

  const params = decodeObjectStrings(result.rows[0].params);

  // 过滤空值，返回扁平键值对
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value && String(value).trim() !== '') {
      flat[key] = String(value);
    }
  }

  return flat;
}

// =====================================================
// 获取产品图片
// =====================================================
export async function getProductImages(id: number): Promise<string[]> {
  try {
    const pResult = await pool.query('SELECT main_image FROM products WHERE id = $1', [id]);
    if (pResult.rows.length > 0 && pResult.rows[0].main_image) {
      return [pResult.rows[0].main_image];
    }
  } catch (e) {
    console.error('getProductImages 失败:', e);
  }
  return [];
}

// =====================================================
// 记录搜索关键词（用于热门搜索）
// =====================================================
export async function logSearch(keyword: string): Promise<void> {
  if (!keyword || !keyword.trim()) return;
  const trimmed = keyword.trim();
  const spaceTerms = extractSearchTerms(trimmed).filter((t) => t.length >= 2);
  const toLog = [...new Set([trimmed, ...spaceTerms])];

  await pool.query(
    `
    INSERT INTO search_logs (keyword, search_count, last_searched_at)
    SELECT k, 1, NOW()
    FROM unnest($1::text[]) AS k
    ON CONFLICT (keyword)
    DO UPDATE SET
      search_count = search_logs.search_count + 1,
      last_searched_at = NOW()
    `,
    [toLog]
  );
}

// =====================================================
// 获取热门搜索词
// =====================================================
export async function getHotSearches(limit: number = 10): Promise<string[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const result = await pool.query(
    `
    SELECT keyword
    FROM search_logs
    WHERE char_length(trim(keyword)) >= 2
    ORDER BY search_count DESC, last_searched_at DESC
    LIMIT $1
    `,
    [safeLimit]
  );
  return result.rows.map((row) => row.keyword as string);
}

// =====================================================
// 获取搜索建议（输入联想）
// =====================================================
export async function getSuggestions(keyword: string, limit: number = 8): Promise<string[]> {
  if (!keyword || !keyword.trim()) return [];
  const trimmed = keyword.trim();

  // 0. 如果输入是中文品牌名，直接添加对应的英文品牌名建议
  const suggestions: string[] = [];
  for (const [cn, en] of Object.entries(brandNameMap)) {
    if (cn.includes(trimmed) || trimmed.includes(cn)) {
      if (!suggestions.includes(cn)) {
        suggestions.push(cn);
      }
    }
  }

  // 1. 从搜索日志中匹配热门搜索词
  if (suggestions.length < limit) {
    const hotMatches = await pool.query(`
      SELECT keyword FROM search_logs
      WHERE keyword ILIKE $1
      ORDER BY search_count DESC
      LIMIT $2
    `, [`%${trimmed}%`, limit - suggestions.length]);

    for (const row of hotMatches.rows) {
      if (!suggestions.includes(row.keyword)) {
        suggestions.push(row.keyword);
      }
    }
  }

  // 2. 从品牌中匹配（支持中英文，排除已软删除产品）
  if (suggestions.length < limit) {
    const brandMatches = await pool.query(`
      SELECT DISTINCT brand FROM products
      WHERE brand ILIKE $1
        AND deleted_at IS NULL
      LIMIT $2
    `, [`%${trimmed}%`, limit - suggestions.length]);

    for (const row of brandMatches.rows) {
      const brand = row.brand;
      // 将英文品牌名转为中文显示
      const cnName = brandEnglishToChinese[brand] || brand;
      if (!suggestions.includes(cnName) && !suggestions.includes(brand)) {
        suggestions.push(cnName);
      }
    }
  }

  // 3. 从产品名称中匹配（排除已软删除产品）
  if (suggestions.length < limit) {
    const nameMatches = await pool.query(`
      SELECT DISTINCT name FROM products
      WHERE name ILIKE $1
        AND deleted_at IS NULL
      LIMIT $2
    `, [`%${trimmed}%`, limit - suggestions.length]);

    for (const row of nameMatches.rows) {
      if (!suggestions.includes(row.name)) {
        suggestions.push(row.name);
      }
    }
  }

  return suggestions.slice(0, limit);
}

// =====================================================
// 新增：获取分类列表（优化后）
// =====================================================
export async function getCategories(): Promise<Array<{
  id: number;
  code: string;
  name: string;
  display_name: string;
  icon: string;
  parent_id: number | null;
  product_count: number;
}>> {
  const result = await pool.query(`
    SELECT
      c.id,
      c.code,
      c.name,
      c.display_name,
      c.icon,
      c.parent_id,
      COUNT(p.id) as product_count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id
    WHERE c.is_active = true
    GROUP BY c.id, c.code, c.name, c.display_name, c.icon, c.parent_id
    ORDER BY c.sort_order, c.name
  `);

  return result.rows;
}

// =====================================================
// 新增：按分类ID获取产品（优化后）
// =====================================================
export async function getProductsByCategoryId(
  categoryId: number,
  page: number = 1,
  limit: number = 20
): Promise<{
  products: any[];
  total: number;
  page: number;
  limit: number;
}> {
  const countResult = await pool.query(
    'SELECT COUNT(*) FROM products WHERE category_id = $1 AND deleted_at IS NULL',
    [categoryId]
  );
  const total = parseInt(countResult.rows[0].count);

  const result = await pool.query(`
    SELECT p.*, c.name as category_name, p.main_image
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.category_id = $1 AND p.deleted_at IS NULL
    ORDER BY p.created_at DESC
    LIMIT $2 OFFSET $3
  `, [categoryId, limit, (page - 1) * limit]);

  return {
    products: decodeObjectStrings(result.rows),
    total,
    page,
    limit,
  };
}

// =====================================================
// 新增：使用视图获取产品详情（优化后）
// =====================================================
export async function getProductViewById(id: number): Promise<any | null> {
  const result = await pool.query(
    'SELECT * FROM products_with_details WHERE id = $1',
    [id]
  );
  return result.rows[0] ? decodeObjectStrings(result.rows[0]) : null;
}

// =====================================================
// 获取产品图片列表（仅主图 main_image）
// =====================================================
export async function getProductImagesList(id: number): Promise<Array<{
  id: number;
  url: string;
  mime_type: string;
}>> {
  try {
    const pResult = await pool.query('SELECT main_image FROM products WHERE id = $1', [id]);
    if (pResult.rows.length > 0 && pResult.rows[0].main_image) {
      return [{
        id: 0,
        url: pResult.rows[0].main_image,
        mime_type: 'image/main',
      }];
    }
  } catch (e) {
    console.error('getProductImagesList 失败:', e);
  }
  return [];
}

// =====================================================
// 新增：更新产品的分类关联
// =====================================================
export async function updateProductCategory(
  productId: number,
  categoryCode: string
): Promise<boolean> {
  const result = await pool.query(`
    UPDATE products
    SET category_id = (SELECT id FROM categories WHERE code = $1)
    WHERE id = $2
    RETURNING id
  `, [categoryCode, productId]);

  return result.rows.length > 0;
}

// =====================================================
// 新增：批量更新产品分类
// =====================================================
export async function batchUpdateProductCategories(): Promise<number> {
  const result = await pool.query(`
    UPDATE products p
    SET category_id = c.id
    FROM categories c
    WHERE p.category = c.code
    AND p.category_id IS NULL
    RETURNING p.id
  `);

  return result.rows.length;
}
