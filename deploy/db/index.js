"use strict";
/**
 * 数据库连接模块
 * 连接 PostgreSQL，提供数据查询接口
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.searchProducts = searchProducts;
exports.getProductById = getProductById;
exports.getProductsByBrand = getProductsByBrand;
exports.getBrands = getBrands;
exports.getProductParams = getProductParams;
exports.getProductImages = getProductImages;
exports.logSearch = logSearch;
exports.getSuggestions = getSuggestions;
exports.getRecommendations = getRecommendations;
exports.getCategories = getCategories;
exports.getProductsByCategoryId = getProductsByCategoryId;
exports.getProductViewById = getProductViewById;
exports.getProductImagesList = getProductImagesList;
exports.updateProductCategory = updateProductCategory;
exports.batchUpdateProductCategories = batchUpdateProductCategories;
const pg_1 = __importDefault(require("pg"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// =====================================================
// HTML 实体解码（处理历史数据）
// =====================================================
function decodeHtmlEntities(text) {
    if (!text || typeof text !== 'string')
        return text;
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
    const entities = {
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
function decodeObjectStrings(obj) {
    if (typeof obj === 'string') {
        return cleanParamValue(decodeHtmlEntities(obj));
    }
    if (Array.isArray(obj)) {
        return obj.map(decodeObjectStrings);
    }
    if (obj && typeof obj === 'object') {
        const decoded = {};
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
function cleanParamValue(value) {
    if (!value)
        return value;
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
exports.pool = new pg_1.default.Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'appliance_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres123',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});
exports.pool.on('error', (err) => {
    console.error('数据库连接池错误:', err);
});
// =====================================================
// 品牌中文名 → 英文名映射
// =====================================================
const brandNameMap = {
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
const brandEnglishToChinese = {};
Object.entries(brandNameMap).forEach(([cn, en]) => {
    brandEnglishToChinese[en] = cn;
});
// =====================================================
// 搜索关键词处理：将用户输入转换为 tsquery
// =====================================================
function formatSearchQuery(keyword) {
    // 移除特殊字符，保留中文、英文、数字
    const cleaned = keyword.replace(/[^一-龥a-zA-Z0-9]/g, ' ').trim();
    if (!cleaned)
        return '';
    // 将空格分隔的词提取出来
    const terms = cleaned.split(/\s+/).filter(t => t.length > 0);
    if (terms.length === 0)
        return '';
    // 将数字和字母单位分离（如 215L → 215 和 L）
    const expandedTerms = [];
    for (const term of terms) {
        const match = term.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z一-龥]+)$/);
        if (match) {
            expandedTerms.push(match[1]);
            if (match[2].length > 0) {
                expandedTerms.push(match[2]);
            }
        }
        else {
            expandedTerms.push(term);
        }
    }
    return expandedTerms.join(' | ');
}
// =====================================================
// 高亮处理：在文本中包裹 <hl> 标签
// =====================================================
function highlightText(text, keyword) {
    if (!text || !keyword)
        return text || '';
    // 提取搜索关键词中的有效词
    const cleaned = keyword.replace(/[^一-龥a-zA-Z0-9]/g, ' ').trim();
    const terms = cleaned.split(/\s+/).filter(t => t.length > 0);
    if (terms.length === 0)
        return text;
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
async function searchProducts(keyword, page = 1, limit = 20) {
    if (!keyword || !keyword.trim()) {
        // 无关键词时，返回所有产品
        const countResult = await exports.pool.query('SELECT COUNT(*) FROM products');
        const total = parseInt(countResult.rows[0].count);
        const result = await exports.pool.query('SELECT * FROM products ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, (page - 1) * limit]);
        return {
            products: decodeObjectStrings(result.rows),
            total,
            page,
            limit,
        };
    }
    // 提取搜索词（中文、英文、数字、点号、连字符）
    const cleaned = keyword.replace(/[^一-龥a-zA-Z0-9.\-]/g, ' ').trim();
    // 按空格分割多个关键词
    const terms = cleaned.split(/\s+/).filter(t => t.length > 0);
    if (terms.length === 0) {
        return { products: [], total: 0, page, limit };
    }
    console.log('搜索调试:', { keyword, terms });
    // 使用 pg_jieba 分词：将每个词用 & 连接（AND 逻辑）
    // 每个词用前缀匹配（:*）支持部分匹配
    const tsQueryParts = terms.map(t => {
        // 英文品牌名直接使用
        if (/^[a-zA-Z]+$/.test(t)) {
            return `${t.toLowerCase()}:*`;
        }
        // 数字+单位（如1.5匹、218L）直接使用
        if (/^[0-9.]+[a-zA-Z一-龥]+$/.test(t)) {
            return `${t}:*`;
        }
        // 中文词使用 pg_jieba 分词
        return t;
    });
    const tsQuery = tsQueryParts.join(' & ');
    console.log('tsQuery:', tsQuery);
    // 查询：使用 search_vector 全文搜索，同时用 ILIKE 作为降级
    const query = `
    SELECT *,
      ts_rank(search_vector, to_tsquery('jiebacfg', $1)) as rank,
      CASE
        WHEN name ILIKE $2 THEN 200
        WHEN brand ILIKE $3 THEN 150
        WHEN model ILIKE $2 THEN 100
        ELSE ts_rank(search_vector, to_tsquery('jiebacfg', $1)) * 100
      END as boost
    FROM products
    WHERE search_vector @@ to_tsquery('jiebacfg', $1)
       OR name ILIKE $2
       OR brand ILIKE $3
       OR model ILIKE $2
       OR pinyin ILIKE $2
    ORDER BY boost DESC, created_at DESC
    LIMIT $4 OFFSET $5
  `;
    const params = [
        tsQuery, // $1: tsquery
        `%${keyword}%`, // $2: name/model/pinyin ILIKE
        `%${keyword.toLowerCase()}%`, // $3: brand ILIKE
        limit, // $4
        (page - 1) * limit, // $5
    ];
    const result = await exports.pool.query(query, params);
    // 计算总数
    const countQuery = `
    SELECT COUNT(*) FROM products
    WHERE search_vector @@ to_tsquery('jiebacfg', $1)
       OR name ILIKE $2
       OR brand ILIKE $3
       OR model ILIKE $2
       OR pinyin ILIKE $2
  `;
    const countParams = [
        tsQuery,
        `%${keyword}%`,
        `%${keyword.toLowerCase()}%`,
    ];
    const countResult = await exports.pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);
    const products = decodeObjectStrings(result.rows).map(p => {
        let img = '/static/default_img.png';
        if (p.images_binary && p.images_binary.length > 0 && p.images_binary[0]) {
            img = `data:image/jpeg;base64,${p.images_binary[0].toString('base64')}`;
        }
        else if (p.images && p.images.length > 0) {
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
async function getProductById(id) {
    const result = await exports.pool.query('SELECT * FROM products WHERE id = $1', [id]);
    return result.rows[0] ? decodeObjectStrings(result.rows[0]) : null;
}
// =====================================================
// 按品牌获取产品
// =====================================================
async function getProductsByBrand(brand) {
    const result = await exports.pool.query('SELECT * FROM products WHERE brand = $1 ORDER BY created_at DESC', [brand]);
    return result.rows;
}
// =====================================================
// 获取品牌列表
// =====================================================
async function getBrands() {
    const result = await exports.pool.query(`
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
async function getProductParams(id) {
    const result = await exports.pool.query('SELECT params FROM products WHERE id = $1', [id]);
    if (result.rows.length === 0) {
        return null;
    }
    const params = decodeObjectStrings(result.rows[0].params);
    // 过滤空值，返回扁平键值对
    const flat = {};
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
async function getProductImages(id) {
    const result = await exports.pool.query('SELECT images, image_id FROM products WHERE id = $1', [id]);
    if (result.rows.length === 0) {
        return [];
    }
    const row = result.rows[0];
    // 优先从 images 表获取二进制图片
    if (row.image_id) {
        const imgResult = await exports.pool.query('SELECT image_data, mime_type FROM images WHERE id = $1', [row.image_id]);
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
async function logSearch(keyword) {
    if (!keyword || !keyword.trim())
        return;
    const trimmed = keyword.trim();
    await exports.pool.query(`SELECT log_search($1)`, [trimmed]);
}
// =====================================================
// 获取搜索建议（输入联想）
// =====================================================
async function getSuggestions(keyword, limit = 8) {
    if (!keyword || !keyword.trim())
        return [];
    const trimmed = keyword.trim();
    // 0. 如果输入是中文品牌名，直接添加对应的英文品牌名建议
    const suggestions = [];
    for (const [cn, en] of Object.entries(brandNameMap)) {
        if (cn.includes(trimmed) || trimmed.includes(cn)) {
            if (!suggestions.includes(cn)) {
                suggestions.push(cn);
            }
        }
    }
    // 1. 从搜索日志中匹配热门搜索词
    if (suggestions.length < limit) {
        const hotMatches = await exports.pool.query(`
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
        const brandMatches = await exports.pool.query(`
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
        const nameMatches = await exports.pool.query(`
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
async function getRecommendations(limit = 6) {
    // 获取品牌统计
    const brandsResult = await exports.pool.query(`
    SELECT brand, COUNT(*) as count
    FROM products
    GROUP BY brand
    ORDER BY count DESC
    LIMIT $1
  `, [limit]);
    // 获取热门产品（按创建时间排序）
    const productsResult = await exports.pool.query(`
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
async function getCategories() {
    const result = await exports.pool.query(`
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
async function getProductsByCategoryId(categoryId, page = 1, limit = 20) {
    const countResult = await exports.pool.query('SELECT COUNT(*) FROM products WHERE category_id = $1', [categoryId]);
    const total = parseInt(countResult.rows[0].count);
    const result = await exports.pool.query(`
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
async function getProductViewById(id) {
    const result = await exports.pool.query('SELECT * FROM products_with_details WHERE id = $1', [id]);
    return result.rows[0] ? decodeObjectStrings(result.rows[0]) : null;
}
// =====================================================
// 新增：获取产品图片列表（统一方式）
// =====================================================
async function getProductImagesList(id) {
    const images = [];
    // 1. 从 images 表获取（优先）
    const imageResult = await exports.pool.query(`
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
        const productResult = await exports.pool.query('SELECT images FROM products WHERE id = $1', [id]);
        if (productResult.rows.length > 0 && productResult.rows[0].images) {
            const urlArray = productResult.rows[0].images;
            urlArray.forEach((url, index) => {
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
async function updateProductCategory(productId, categoryCode) {
    const result = await exports.pool.query(`
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
async function batchUpdateProductCategories() {
    const result = await exports.pool.query(`
    UPDATE products p
    SET category_id = c.id
    FROM categories c
    WHERE p.category = c.code
    AND p.category_id IS NULL
    RETURNING p.id
  `);
    return result.rows.length;
}
