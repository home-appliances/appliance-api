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
// 高亮处理：在文本中包裹 <hl> 标签
// =====================================================
function highlightText(text: string, keyword: string): string {
  if (!text || !keyword) return text || '';

  // 提取搜索关键词中的有效词
  const cleaned = keyword.replace(/[^一-龥a-zA-Z0-9]/g, ' ').trim();
  const terms = cleaned.split(/\s+/).filter(t => t.length > 0);

  if (terms.length === 0) return text;

  // 对每个词进行高亮（按长度降序，避免短词覆盖长词）
  terms.sort((a, b) => b.length - a.length);
  let result = text;
  for (const term of terms) {
    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    result = result.replace(regex, `<hl>$&</hl>`);
  }

  return result;
}

// =====================================================
// 搜索产品（全文搜索 + 相关性排序）
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
  if (!keyword || !keyword.trim()) {
    // 无关键词时，返回所有产品
    const countResult = await pool.query('SELECT COUNT(*) FROM products');
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      'SELECT * FROM products ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, (page - 1) * limit]
    );

    return {
      products: decodeObjectStrings(result.rows),
      total,
      page,
      limit,
    };
  }

  // 提取搜索词（中文、英文、数字）
  const cleaned = keyword.replace(/[^一-龥a-zA-Z0-9]/g, ' ').trim();

  // 智能分词：优先匹配品牌词和类别词
  const allDictWords = [
    // 品牌词
    '小米', '格力', '海尔', '美的', '奥克斯', '海信', 'tcl', '松下', '大金', '三菱',
    '科龙', '志高', '长虹', '扬子', '惠而浦', '富士通', '日立', '康佳', '飞利浦', '统帅',
    '米家', '华凌', '卡萨帝', 'colmo', '小天鹅', '酷开',
    // 类别词
    '空调', '冰箱', '冰柜', '洗衣机', '热水器', '电视', '电饭煲', '取暖器',
    '柜机', '挂机', '滚筒', '波轮', '洗烘', '燃气', '电热', '空气能',
    '液晶', '智能', '暖风机', '油汀', '电饭锅', '压力锅', '油烟机', '吸油烟机',
  ];

  // 从长到短匹配词典
  let remaining = cleaned;
  const terms: string[] = [];
  allDictWords.sort((a, b) => b.length - a.length); // 按长度降序

  while (remaining.length > 0) {
    let matched = false;
    for (const word of allDictWords) {
      if (remaining.startsWith(word)) {
        terms.push(word);
        remaining = remaining.substring(word.length).trim();
        matched = true;
        break;
      }
    }
    if (!matched) {
      // 没有匹配到词典，取第一个字/词
      const nextWord = remaining.charAt(0);
      terms.push(nextWord);
      remaining = remaining.substring(1).trim();
    }
  }

  // 如果分词结果为空，使用简单的空格分割
  if (terms.length === 0) {
    terms.push(...cleaned.split(/\s+/).filter(t => t.length > 0));
  }

  if (terms.length === 0) {
    return { products: [], total: 0, page, limit };
  }

  // 将中文品牌名解析为英文品牌名
  let brandFilter = keyword.trim();
  const lowerKeyword = keyword.toLowerCase().trim();
  if (brandNameMap[lowerKeyword]) {
    brandFilter = brandNameMap[lowerKeyword];
  } else if (brandNameMap[keyword.trim()]) {
    brandFilter = brandNameMap[keyword.trim()];
  }

  // 产品大类词（搜索这些词时返回该类别的所有产品）
  const categoryKeywords = [
    '冰箱', '冰柜', '冷柜', '冷藏', '冷冻',
    '空调', '柜机', '挂机', '中央空调',
    '洗衣机', '滚筒', '波轮', '洗烘',
    '热水器', '燃气热水器', '电热水器', '空气能',
    '电视', '液晶电视', '智能电视',
    '取暖器', '暖风机', '油汀',
    '电饭煲', '电饭锅', '压力锅',
    '油烟机', '吸油烟机'
  ];

  // 品牌关键词
  const brandKeywords: Record<string, string> = {
    '小米': 'xiaomi', '格力': 'gree', '海尔': 'haier', '美的': 'midea',
    '奥克斯': 'aux', '海信': 'hisense', 'tcl': 'tcl', '松下': 'panasonic',
    '大金': 'daikin', '三菱': 'mitsubishi', '科龙': 'kelon', '志高': 'chigo',
    '长虹': 'changhong', '扬子': 'yangzi', '惠而浦': 'whirlpool', '富士通': 'fujitsu',
    '日立': 'hitachi', '康佳': 'konka', '飞利浦': 'philips', '统帅': 'tongshuai',
    '米家': 'xiaomi', '华凌': 'midea', '卡萨帝': 'haier',
  };

  let isCategorySearch = categoryKeywords.some(kw => lowerKeyword.includes(kw));
  const hasBrandKeyword = terms.some(t => brandKeywords[t] || brandKeywords[t.toLowerCase()]);

  console.log('搜索调试:', { keyword, terms, isCategorySearch, hasBrandKeyword });

  // 构建 tsquery：使用 | (OR) 匹配任意一个词
  const tsQuery = terms.join(' | ');

  // 全文搜索查询，按相关性排序
  let query: string;
  let params: any[];

  // 如果同时有品牌和类别关键词，使用分词搜索
  if (isCategorySearch && hasBrandKeyword) {
    // 进入分词搜索逻辑（下面的 else 分支）
    isCategorySearch = false;
    console.log('切换到分词搜索模式');
  }

  if (isCategorySearch) {
    // 搜索产品大类（如"洗衣机"）时，按类别过滤返回该类别的所有产品
    // 将类别关键词映射到数据库 category 字段
    const categoryMap: Record<string, string> = {
      '冰箱': 'icebox', '冰柜': 'icebox', '冷柜': 'icebox', '冷藏': 'icebox', '冷冻': 'icebox',
      '空调': 'air_condition', '柜机': 'air_condition', '挂机': 'air_condition', '中央空调': 'air_condition',
      '洗衣机': 'washer', '滚筒': 'washer', '波轮': 'washer', '洗烘': 'washer',
      '热水器': 'gas_water', '燃气热水器': 'gas_water', '电热水器': 'gas_water', '空气能': 'central_water',
      '电视': 'lcd_tv', '液晶电视': 'lcd_tv', '智能电视': 'lcd_tv',
      '取暖器': 'heater', '暖风机': 'heater', '油汀': 'heater',
      '电饭煲': 'rice_cooker', '电饭锅': 'rice_cooker', '压力锅': 'rice_cooker',
      '油烟机': 'rice_cooker', '吸油烟机': 'rice_cooker',
    };

    // 找到匹配的类别
    let matchedCategory = '';
    for (const [kw, cat] of Object.entries(categoryMap)) {
      if (lowerKeyword.includes(kw)) {
        matchedCategory = cat;
        break;
      }
    }

    if (matchedCategory) {
      // 按类别过滤
      query = `
        SELECT *, 0 as rank, 0 as brand_boost
        FROM products
        WHERE category = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `;
      params = [matchedCategory, limit, (page - 1) * limit];

      const countResult = await pool.query('SELECT COUNT(*) FROM products WHERE category = $1', [matchedCategory]);
      var total = parseInt(countResult.rows[0].count);
    } else {
      // 未匹配到类别，返回所有产品
      query = `
        SELECT *, 0 as rank, 0 as brand_boost
        FROM products
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
      `;
      params = [limit, (page - 1) * limit];

      const countResult = await pool.query('SELECT COUNT(*) FROM products');
      var total = parseInt(countResult.rows[0].count);
    }
  } else {
    // 普通搜索 - 支持分词搜索
    // 将关键词分词（支持中文、英文、数字）
    const searchTerms = terms.length > 0 ? terms : [keyword];

    // 构建分词匹配条件（参数从 $5 开始）
    const termConditions = searchTerms.map((_, i) => {
      const idx = i + 5;
      return `(name ILIKE $${idx} OR brand ILIKE $${idx} OR model ILIKE $${idx})`;
    }).join(' OR ');

    // 构建品牌匹配条件
    const brandBoostParts: string[] = [];
    const nameBoostParts: string[] = [];
    const brandMap: Record<string, string> = {
      '小米': 'xiaomi', '格力': 'gree', '海尔': 'haier', '美的': 'midea',
      '奥克斯': 'aux', '海信': 'hisense', 'tcl': 'tcl', '松下': 'panasonic',
      '大金': 'daikin', '三菱': 'mitsubishi', '科龙': 'kelon', '志高': 'chigo',
      '长虹': 'changhong', '扬子': 'yangzi', '惠而浦': 'whirlpool', '富士通': 'fujitsu',
      '日立': 'hitachi', '康佳': 'konka', '飞利浦': 'philips', '统帅': 'tongshuai',
      '米家': 'xiaomi', '华凌': 'midea', '卡萨帝': 'haier',
    };
    for (const term of searchTerms) {
      const mapped = brandMap[term] || brandMap[term.toLowerCase()];
      if (mapped) {
        brandBoostParts.push(`brand = '${mapped}'`);
        // 子品牌需要名称匹配
        if (term !== mapped) {
          nameBoostParts.push(`name LIKE '%${term}%'`);
        }
      }
    }

    // 构建类别匹配条件
    const categoryBoostParts: string[] = [];
    const categoryMap2: Record<string, string> = {
      '空调': 'air_condition', '冰箱': 'icebox', '洗衣机': 'washer',
      '热水器': 'gas_water', '电视': 'lcd_tv', '电饭煲': 'rice_cooker', '取暖器': 'heater',
    };
    for (const term of searchTerms) {
      const cat = categoryMap2[term] || categoryMap2[term.toLowerCase()];
      if (cat) categoryBoostParts.push(`'${cat}'`);
    }

    // 名称匹配优先级最高（120分），品牌匹配次之（100分），类别匹配（50分）
    const nameBoostSQL = nameBoostParts.length > 0 ? `WHEN ${nameBoostParts.join(' OR ')} THEN 120` : '';
    const brandBoostSQL = brandBoostParts.length > 0 ? `WHEN ${brandBoostParts.join(' OR ')} THEN 100` : '';
    const categoryBoostSQL = categoryBoostParts.length > 0 ? `WHEN category IN (${categoryBoostParts.join(',')}) THEN 50` : '';

    // 主查询：$1-$4 固定，$5... searchTerms，最后 $N-1=limit, $N=offset
    const limitIdx = 5 + searchTerms.length;
    const offsetIdx = limitIdx + 1;

    query = `
      SELECT *,
        CASE ${nameBoostSQL} ${brandBoostSQL} ${categoryBoostSQL} ELSE 0 END as brand_boost
      FROM products
      WHERE search_vector @@ to_tsquery('simple', $1)
         OR ${termConditions}
         OR brand ILIKE $2
         OR brand ILIKE $3
         OR pinyin ILIKE $4
      ORDER BY brand_boost DESC, created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    params = [
      tsQuery,
      `%${brandFilter}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      ...searchTerms.map(t => `%${t}%`),
      limit,
      (page - 1) * limit,
    ];

    // 计算总数（不需要 limit/offset）
    const countQuery = `
      SELECT COUNT(*) FROM products
      WHERE search_vector @@ to_tsquery('simple', $1)
         OR ${termConditions}
         OR brand ILIKE $2
         OR brand ILIKE $3
         OR pinyin ILIKE $4
    `;
    const countParams = [
      tsQuery,
      `%${brandFilter}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      ...searchTerms.map(t => `%${t}%`),
    ];
    const countResult = await pool.query(countQuery, countParams);
    var total = parseInt(countResult.rows[0].count);
  }

  const result = await pool.query(query, params);

  // 添加高亮标记（只处理 title，tag 由路由层根据类别动态生成）
  const products = decodeObjectStrings(result.rows).map(p => {
    // 处理图片：优先使用二进制数据
    let img = '/static/default_img.png';
    if (p.images_binary && p.images_binary.length > 0 && p.images_binary[0]) {
      img = `data:image/jpeg;base64,${p.images_binary[0].toString('base64')}`;
    } else if (p.images && p.images.length > 0) {
      img = p.images[0];
    }

    return {
      ...p,
      title: highlightText(p.name, keyword),
      img,
    };
  });

  return {
    products,
    total,
    page,
    limit,
  };
}

// =====================================================
// 获取产品详情
// =====================================================
export async function getProductById(id: number): Promise<any | null> {
  const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
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
  const result = await pool.query('SELECT images, image_id FROM products WHERE id = $1', [id]);

  if (result.rows.length === 0) {
    return [];
  }

  const row = result.rows[0];

  // 优先从 images 表获取二进制图片
  if (row.image_id) {
    const imgResult = await pool.query('SELECT image_data, mime_type FROM images WHERE id = $1', [row.image_id]);
    if (imgResult.rows.length > 0 && imgResult.rows[0].image_data) {
      const img = imgResult.rows[0];
      // 过滤过小的图片数据（已损坏/截断的图片可能只有几字节）
      if (img.image_data.length > 1024) {
        const base64 = img.image_data.toString('base64');
        return [`data:${img.mime_type};base64,${base64}`];
      }
      console.warn('getProductImages 图片数据过小，跳过:', row.image_id, img.image_data.length);
    }
  }

  // 降级返回 URL 数组
  return row.images || [];
}

// =====================================================
// 记录搜索关键词（用于热门搜索）
// =====================================================
export async function logSearch(keyword: string): Promise<void> {
  if (!keyword || !keyword.trim()) return;
  const trimmed = keyword.trim();
  await pool.query(`SELECT log_search($1)`, [trimmed]);
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

  // 2. 从品牌中匹配（支持中英文）
  if (suggestions.length < limit) {
    const brandMatches = await pool.query(`
      SELECT DISTINCT brand FROM products
      WHERE brand ILIKE $1
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

  // 3. 从产品名称中匹配
  if (suggestions.length < limit) {
    const nameMatches = await pool.query(`
      SELECT DISTINCT name FROM products
      WHERE name ILIKE $1
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
// 获取推荐数据（空结果时使用）
// =====================================================
export async function getRecommendations(limit: number = 6): Promise<{
  brands: Array<{ brand: string; count: number }>;
  hotProducts: any[];
}> {
  // 获取品牌统计
  const brandsResult = await pool.query(`
    SELECT brand, COUNT(*) as count
    FROM products
    GROUP BY brand
    ORDER BY count DESC
    LIMIT $1
  `, [limit]);

  // 获取热门产品（按创建时间排序）
  const productsResult = await pool.query(`
    SELECT * FROM products
    ORDER BY created_at DESC
    LIMIT $1
  `, [limit]);

  return {
    brands: brandsResult.rows,
    hotProducts: decodeObjectStrings(productsResult.rows),
  };
}

// =====================================================
// 新增：获取分类列表（优化后）
// =====================================================
export async function getCategories(): Promise<Array<{
  id: number;
  code: string;
  name: string;
  parent_id: number | null;
  product_count: number;
}>> {
  const result = await pool.query(`
    SELECT
      c.id,
      c.code,
      c.name,
      c.parent_id,
      COUNT(p.id) as product_count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id
    WHERE c.is_active = true
    GROUP BY c.id, c.code, c.name, c.parent_id
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
    'SELECT COUNT(*) FROM products WHERE category_id = $1',
    [categoryId]
  );
  const total = parseInt(countResult.rows[0].count);

  const result = await pool.query(`
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.category_id = $1
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
// 新增：获取产品图片列表（统一方式）
// =====================================================
export async function getProductImagesList(id: number): Promise<Array<{
  id: number;
  url: string;
  mime_type: string;
}>> {
  const images: Array<{ id: number; url: string; mime_type: string }> = [];

  // 1. 从 images 表获取（优先）
  const imageResult = await pool.query(`
    SELECT i.id, i.image_data, i.mime_type
    FROM products p
    JOIN images i ON p.image_id = i.id
    WHERE p.id = $1
  `, [id]);

  if (imageResult.rows.length > 0) {
    const img = imageResult.rows[0];
    images.push({
      id: img.id,
      url: `data:${img.mime_type};base64,${img.image_data.toString('base64')}`,
      mime_type: img.mime_type,
    });
  }

  // 2. 降级：从 products.images 数组获取（兼容旧数据）
  if (images.length === 0) {
    const productResult = await pool.query(
      'SELECT images FROM products WHERE id = $1',
      [id]
    );

    if (productResult.rows.length > 0 && productResult.rows[0].images) {
      const urlArray = productResult.rows[0].images;
      urlArray.forEach((url: string, index: number) => {
        if (url) {
          images.push({
            id: -index - 1, // 负数ID表示来自数组
            url: url,
            mime_type: 'image/unknown',
          });
        }
      });
    }
  }

  return images;
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
