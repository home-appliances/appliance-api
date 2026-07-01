/**
 * ZOL (中关村在线) 爬虫客户端
 * 数据源: https://detail.zol.com.cn/
 * 支持品类: 空调、冰箱、洗衣机、电视等
 */

import { config } from '../config';
import * as iconv from 'iconv-lite';

export interface ZolProduct {
  id: string;
  name: string;
  brand: string;
  model: string;
  category: string;
  images: string[];
  params: Record<string, string>;
  source_url: string;
  source_platform: string;
}

// ZOL 品类配置
export const ZOL_CATEGORIES = {
  air_condition: {
    name: '空调',
    baseUrl: 'https://ac.zol.com.cn',
    listUrl: 'https://detail.zol.com.cn/air-condition/',
    productUrl: 'https://detail.zol.com.cn/air-condition/index{id}.shtml',
    paramUrl: 'https://detail.zol.com.cn/{section}/{id}/param.shtml',
    section: '2110', // 空调的 section
  },
  icebox: {
    name: '冰箱',
    baseUrl: 'https://icebox.zol.com.cn',
    listUrl: 'https://detail.zol.com.cn/icebox/',
    productUrl: 'https://detail.zol.com.cn/icebox/index{id}.shtml',
    paramUrl: 'https://detail.zol.com.cn/{section}/{id}/param.shtml',
    section: '2111', // 冰箱的 section
  },
  washer: {
    name: '洗衣机',
    baseUrl: 'https://washer.zol.com.cn',
    listUrl: 'https://detail.zol.com.cn/washer/',
    productUrl: 'https://detail.zol.com.cn/washer/index{id}.shtml',
    paramUrl: 'https://detail.zol.com.cn/{section}/{id}/param.shtml',
    section: '2112', // 洗衣机的 section
  },
  lcd_tv: {
    name: '电视',
    baseUrl: 'https://tv.zol.com.cn',
    listUrl: 'https://detail.zol.com.cn/lcd-tv/',
    productUrl: 'https://detail.zol.com.cn/lcd-tv/index{id}.shtml',
    paramUrl: 'https://detail.zol.com.cn/{section}/{id}/param.shtml',
    section: '2113', // 电视的 section
  },
};

// ZOL 品牌映射（扩展）
const brandMap: Record<string, string> = {
  // 空调品牌
  '格力': 'gree', '美的': 'midea', '海尔': 'haier', '奥克斯': 'aux',
  'TCL': 'tcl', '海信': 'hisense', '松下': 'panasonic', '三菱电机': 'mitsubishi',
  '大金': 'daikin', '科龙': 'kelon', '志高': 'chigo', '小米': 'xiaomi',
  '长虹': 'changhong', '康佳': 'konka', '飞利浦': 'philips', '创维': 'skyworth',
  '西门子': 'siemens', '三星': 'samsung', 'LG': 'lg', '索尼': 'sony',
  '富士通将军': 'fujitsugeneral', '东芝': 'toshiba', '惠而浦': 'whirlpool',
  '华凌': 'hualing',

  // 冰箱品牌
  '容声': 'rongsheng', '美菱': 'meiling', '卡萨帝': 'casarte',
  '博世': 'bosch', '伊莱克斯': 'electrolux',

  // 洗衣机品牌
  '小天鹅': 'little_swan', '三洋': 'sanyo', '统帅': 'leader',
  '博世': 'bosch',

  // 电视品牌
  '索尼': 'sony', '夏普': 'sharp', '飞利浦': 'philips',
  '长虹': 'changhong', '康佳': 'konka', '创维': 'skyworth',
  '乐视': 'letv', '华为': 'huawei',
};

export class ZolClient {
  private baseUrl = 'https://detail.zol.com.cn';
  private headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'identity',
  };

  /**
   * 获取页面并解码 GBK
   */
  private async fetchGBK(url: string): Promise<string> {
    try {
      const response = await fetch(url, { headers: this.headers });
      const buffer = await response.arrayBuffer();
      const bytes = Buffer.from(buffer);
      const html = iconv.decode(bytes, 'gbk');
      return html;
    } catch (error) {
      console.error(`获取页面失败: ${url}`, error);
      return '';
    }
  }

  /**
   * 获取产品列表页（支持多品类）
   */
  async getProductList(category: string = 'air_condition', page: number = 1): Promise<{
    products: Array<{ id: string; url: string; name: string }>;
    total: number;
  }> {
    const categoryConfig = ZOL_CATEGORIES[category as keyof typeof ZOL_CATEGORIES];
    if (!categoryConfig) {
      console.error(`未知品类: ${category}`);
      return { products: [], total: 0 };
    }

    // 构建列表页 URL
    const categorySlug = category === 'lcd_tv' ? 'lcd-tv' : category;
    const listUrl = page === 1
      ? categoryConfig.listUrl
      : `${categoryConfig.listUrl}index${page}.shtml`;

    try {
      const html = await this.fetchGBK(listUrl);
      if (!html) return { products: [], total: 0 };

      // 解析产品列表（支持多种格式）
      const products: Array<{ id: string; url: string; name: string }> = [];
      const seenIds = new Set<string>();

      // 格式1: href=".../index{id}.shtml"
      const regex1 = new RegExp(`href="[^"]*\\/${categorySlug}\\/index(\\d+)\\.shtml"[^>]*>([^<]+)<`, 'g');
      let match;
      while ((match = regex1.exec(html)) !== null) {
        if (!seenIds.has(match[1])) {
          seenIds.add(match[1]);
          products.push({
            id: match[1],
            url: `${this.baseUrl}/${categorySlug}/index${match[1]}.shtml`,
            name: match[2].trim(),
          });
        }
      }

      // 格式2: href=".../{id}.shtml" (某些品类)
      const regex2 = new RegExp(`href="[^"]*\\/${categorySlug}\\/(\\d+)\\.shtml"[^>]*>([^<]+)<`, 'g');
      while ((match = regex2.exec(html)) !== null) {
        if (!seenIds.has(match[1])) {
          seenIds.add(match[1]);
          products.push({
            id: match[1],
            url: `${this.baseUrl}/${categorySlug}/${match[1]}.shtml`,
            name: match[2].trim(),
          });
        }
      }

      return { products, total: products.length };
    } catch (error) {
      console.error('获取ZOL产品列表失败:', error);
      return { products: [], total: 0 };
    }
  }

  /**
   * 获取产品详情（支持多品类）
   */
  async getProductDetail(productId: string, category: string = 'air_condition'): Promise<ZolProduct | null> {
    const categoryConfig = ZOL_CATEGORIES[category as keyof typeof ZOL_CATEGORIES];
    if (!categoryConfig) {
      console.error(`未知品类: ${category}`);
      return null;
    }

    const categorySlug = category === 'lcd_tv' ? 'lcd-tv' : category;
    const detailUrl = `${this.baseUrl}/${categorySlug}/index${productId}.shtml`;
    const paramUrl = `${this.baseUrl}/${categoryConfig.section}/${productId}/param.shtml`;

    try {
      // 获取详情页
      const detailHtml = await this.fetchGBK(detailUrl);

      // 获取参数页
      let paramHtml = '';
      try {
        paramHtml = await this.fetchGBK(paramUrl);
      } catch {
        // 参数页获取失败不影响主流程
      }

      // 合并 HTML 解析
      const fullHtml = detailHtml + paramHtml;

      // 解析产品信息
      return this.parseProductDetail(fullHtml, productId, detailUrl, category);
    } catch (error) {
      console.error(`获取ZOL产品详情失败 [${productId}]:`, error);
      return null;
    }
  }

  /**
   * 解析产品详情页
   */
  private parseProductDetail(html: string, productId: string, sourceUrl: string, category: string = 'air_condition'): ZolProduct | null {
    // 提取产品名称
    const nameMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
    const name = nameMatch ? nameMatch[1].trim() : '';

    if (!name) return null;

    // 从名称中提取品牌（通常是第一个中文字符或已知品牌）
    let brand = '';
    let brandCn = '';
    for (const [cn, en] of Object.entries(brandMap)) {
      if (name.includes(cn)) {
        brandCn = cn;
        brand = en;
        break;
      }
    }

    // 提取型号（根据不同品类使用不同的正则）
    let model = '';
    if (category === 'air_condition') {
      // 空调型号: KFR-26GW/N8HA1
      const modelMatch = name.match(/([A-Z]{2,}[-\/][A-Z0-9\-\/]+)/i);
      model = modelMatch ? modelMatch[1] : '';
    } else if (category === 'icebox') {
      // 冰箱型号: BCD-502WGHTD1CDWU1
      const modelMatch = name.match(/(BC[Dd]-?[A-Z0-9\-\/]+)/i);
      model = modelMatch ? modelMatch[1] : '';
    } else if (category === 'washer') {
      // 洗衣机型号: XQG100-HB14126L
      const modelMatch = name.match(/(X[QPWG][A-Z]\d+[A-Z0-9\-\/]*)/i);
      model = modelMatch ? modelMatch[1] : '';
    } else if (category === 'lcd_tv') {
      // 电视型号: KD-65X9500H
      const modelMatch = name.match(/([A-Z]{2,}-?\d+[A-Z0-9\-\/]*)/i);
      model = modelMatch ? modelMatch[1] : '';
    } else {
      // 通用型号提取
      const modelMatch = name.match(/([A-Z]{2,}[-\/][A-Z0-9\-\/]+)/i);
      model = modelMatch ? modelMatch[1] : '';
    }

    // 提取图片
    const images: string[] = [];
    const imgRegex = /src="(https?:\/\/[^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/gi;
    let imgMatch;
    while ((imgMatch = imgRegex.exec(html)) !== null) {
      if (imgMatch[1].includes('zol-img.com.cn') && !imgMatch[1].includes('icon')) {
        images.push(imgMatch[1]);
      }
    }

    // 提取参数（新格式：newPmName_X / newPmVal_X）
    const params: Record<string, string> = {};

    // 新格式
    const newParamRegex = /newPmName_\d+">([^<]+)<\/span><\/th>\s*<td[^>]*><span[^>]*newPmVal_\d+">([^<]+)/g;
    let paramMatch;
    while ((paramMatch = newParamRegex.exec(html)) !== null) {
      const key = paramMatch[1].trim();
      const value = paramMatch[2].replace(/<[^>]+>/g, '').trim(); // 去除内嵌标签
      if (key && value) {
        params[key] = value;
      }
    }

    // 旧格式
    if (Object.keys(params).length === 0) {
      const oldParamRegex = /<th[^>]*>([^<]+)<\/th>\s*<td[^>]*>([^<]+)<\/td>/g;
      while ((paramMatch = oldParamRegex.exec(html)) !== null) {
        const key = paramMatch[1].trim();
        const value = paramMatch[2].trim();
        if (key && value) {
          params[key] = value;
        }
      }
    }

    return {
      id: productId,
      name,
      brand,
      model,
      category,
      images: [...new Set(images)].slice(0, 10),
      params,
      source_url: sourceUrl,
      source_platform: 'zol',
    };
  }

  /**
   * 批量获取产品
   */
  async batchGetProducts(ids: string[]): Promise<ZolProduct[]> {
    const results: ZolProduct[] = [];

    for (const id of ids) {
      const product = await this.getProductDetail(id);
      if (product) {
        results.push(product);
      }
      // 限流
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return results;
  }
}

export default new ZolClient();
