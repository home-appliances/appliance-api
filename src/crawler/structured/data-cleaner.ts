/**
 * 数据清洗模块
 * 功能：品牌标准化、型号标准化、参数值清洗、能效等级标准化
 */

// =====================================================
// 类型定义
// =====================================================

export interface Product {
  id: string;
  name: string;
  brand: string;
  brand_cn: string;
  model: string;
  category: string;
  price: number | null;
  images: string[];
  params: Record<string, string>;
  source: {
    platform: string;
    url: string;
  };
}

// =====================================================
// 品牌映射表（中文 → 英文）
// =====================================================

const brandMap: Record<string, string> = {
  // 空调品牌
  '格力': 'gree', '美的': 'midea', '海尔': 'haier', '奥克斯': 'aux',
  'TCL': 'tcl', '海信': 'hisense', '松下': 'panasonic', '三菱电机': 'mitsubishi',
  '大金': 'daikin', '科龙': 'kelon', '志高': 'chigo', '小米': 'xiaomi',
  '长虹': 'changhong', '康佳': 'konka', '飞利浦': 'philips', '创维': 'skyworth',
  '西门子': 'siemens', '三星': 'samsung', 'LG': 'lg', '索尼': 'sony',
  '富士通将军': 'fujitsugeneral', '东芝': 'toshiba', '惠而浦': 'whirlpool',
  '三菱重工': 'mitsubishi_heavy', '约克': 'york', '日立': 'hitachi',

  // 厨卫品牌
  '方太': 'fotile', '老板': 'robam', '华帝': 'vatti', '万和': 'vanward',
  '万家乐': 'macro', '林内': 'noritz', '能率': 'noritz',
  'A.O.史密斯': 'a_o_smith', '阿里斯顿': 'ariston', '博世': 'bosch',
  '帅康': 'sacon', '樱花': 'sakura', '康宝': 'canbo', '火王': 'firewang',
  '苏泊尔': 'supor', '九阳': 'joyoung', '爱仕达': 'asder',

  // 冰箱/洗衣机品牌
  '新飞': 'xinfei', '容声': 'rongsheng', '美菱': 'meiling',
  '卡萨帝': 'casarte', '小天鹅': 'little_swan', '三洋': 'sanyo',
  '统帅': 'leader', '米家': 'xiaomi',
};

// =====================================================
// 品牌标准化
// =====================================================

export function normalizeBrand(brand: string): { en: string; cn: string } {
  if (!brand) return { en: '', cn: '' };

  // 尝试直接匹配
  if (brandMap[brand]) {
    return { en: brandMap[brand], cn: brand };
  }

  // 尝试小写匹配
  const lowerBrand = brand.toLowerCase();
  if (brandMap[lowerBrand]) {
    return { en: brandMap[lowerBrand], cn: brand };
  }

  // 反向查找（英文输入）
  for (const [cn, en] of Object.entries(brandMap)) {
    if (en === lowerBrand || en === brand) {
      return { en, cn };
    }
  }

  return { en: lowerBrand, cn: brand };
}

// =====================================================
// 型号标准化
// =====================================================

export function normalizeModel(model: string): string {
  if (!model) return '';

  // 去除多余空格
  let normalized = model.replace(/\s+/g, '').trim();

  // 统一括号格式
  normalized = normalized.replace(/（/g, '(').replace(/）/g, ')');

  // 去除型号中的中文描述
  normalized = normalized.replace(/(变频|定频|冷暖|单冷|一级能效|二级能效|三级能效)/g, '');

  return normalized;
}

// =====================================================
// 参数值清洗
// =====================================================

export function cleanParamValue(key: string, value: string): string {
  if (!value) return '';

  let cleaned = value.trim();

  // 1. 去除 HTML 实体
  cleaned = cleaned.replace(/&#\d+;/g, '');
  cleaned = cleaned.replace(/&[a-zA-Z]+;/g, '');

  // 2. 去除推广文本（"-- XXX是什么"、"查看所有XXX"）
  cleaned = cleaned.replace(/--.*$/, '').trim();
  cleaned = cleaned.replace(/查看所有.*$/, '').trim();
  cleaned = cleaned.replace(/是什么.*$/, '').trim();
  cleaned = cleaned.replace(/有哪些.*$/, '').trim();
  cleaned = cleaned.replace(/的区别.*$/, '').trim();
  cleaned = cleaned.replace(/有几种.*$/, '').trim();

  // 3. 去除多余符号
  cleaned = cleaned.replace(/^[•·\s]+/, '').trim();
  cleaned = cleaned.replace(/[•·\s]+$/, '').trim();

  // 4. 能效等级标准化
  if (key.includes('能效') || key.includes('能耗')) {
    cleaned = normalizeEnergyLevel(cleaned);
  }

  // 5. 制冷方式标准化
  if (key.includes('制冷方式') || key.includes('循环方式')) {
    cleaned = normalizeCoolingType(cleaned);
  }

  return cleaned;
}

// =====================================================
// 能效等级标准化
// =====================================================

function normalizeEnergyLevel(value: string): string {
  if (!value) return '';

  // 数字等级
  if (/^[1-5]$/.test(value)) {
    const map: Record<string, string> = {
      '1': '一级能效', '2': '二级能效', '3': '三级能效',
      '4': '四级能效', '5': '五级能效'
    };
    return map[value];
  }

  // 已经是中文
  if (/^(一级|二级|三级|四级|五级)能效$/.test(value)) {
    return value;
  }

  // 部分匹配
  if (value.includes('一级') || value.includes('1级')) return '一级能效';
  if (value.includes('二级') || value.includes('2级')) return '二级能效';
  if (value.includes('三级') || value.includes('3级')) return '三级能效';

  // A+++ 等格式
  if (/A\+\+\+/.test(value)) return '一级能效';
  if (/A\+\+/.test(value)) return '一级能效';
  if (/A\+/.test(value)) return '二级能效';
  if (/^A$/.test(value)) return '二级能效';

  return value;
}

// =====================================================
// 制冷方式标准化
// =====================================================

function normalizeCoolingType(value: string): string {
  if (!value) return '';

  if (value.includes('风冷') || value.includes('间冷')) return '风冷';
  if (value.includes('直冷')) return '直冷';
  if (value.includes('风直冷') || value.includes('混合')) return '风直冷混合';

  return value;
}

// =====================================================
// 清洗产品参数
// =====================================================

export function cleanParams(params: Record<string, string>): Record<string, string> {
  const cleaned: Record<string, string> = {};

  for (const [key, value] of Object.entries(params)) {
    const cleanKey = key.trim();
    const cleanValue = cleanParamValue(key, value);

    if (cleanKey && cleanValue) {
      cleaned[cleanKey] = cleanValue;
    }
  }

  return cleaned;
}

// =====================================================
// 主清洗函数
// =====================================================

export function cleanProduct(product: Product): Product {
  // 品牌标准化
  const { en: brandEn, cn: brandCn } = normalizeBrand(product.brand);

  // 型号标准化
  const model = normalizeModel(product.model);

  // 参数清洗
  const params = cleanParams(product.params);

  return {
    ...product,
    brand: brandEn,
    brand_cn: brandCn || product.brand_cn,
    model,
    params,
  };
}

// =====================================================
// 批量清洗
// =====================================================

export function cleanProducts(products: Product[]): Product[] {
  return products.map(cleanProduct);
}

// =====================================================
// 去重
// =====================================================

export function deduplicateProducts(products: Product[]): Product[] {
  const grouped = new Map<string, Product[]>();

  // 按 brand_model 分组
  for (const product of products) {
    const key = product.brand && product.model
      ? `${product.brand}_${product.model}`
      : `name_${product.name}`;

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(product);
  }

  // 合并重复产品
  const merged: Product[] = [];

  for (const [, group] of grouped) {
    if (group.length === 1) {
      merged.push(group[0]);
    } else {
      // 合并逻辑：取更完整的数据
      let result = { ...group[0] };

      for (let i = 1; i < group.length; i++) {
        const other = group[i];

        // 取更长的名称
        if (other.name.length > result.name.length) {
          result.name = other.name;
        }

        // 合并图片（去重）
        const allImages = [...new Set([...result.images, ...other.images])];
        result.images = allImages.slice(0, 20);

        // 参数合并（新源优先）
        result.params = { ...result.params, ...other.params };

        // 价格取非空值
        if (other.price && !result.price) {
          result.price = other.price;
        }
      }

      merged.push(result);
    }
  }

  return merged;
}
