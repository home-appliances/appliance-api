/**
 * PConline Kitchen (太平洋电脑网厨卫) 爬虫客户端
 * 数据源: https://kitchen.pconline.com.cn/
 */

import { config } from '../config';

export interface PconlineKitchenProduct {
  id: string;
  name: string;
  brand: string;
  model: string;
  category: string;
  images: string[];
  params: Record<string, string>;
  price: number | null;
  source_url: string;
  source_platform: string;
}

// PConline 品牌映射
const brandMap: Record<string, string> = {
  '方太': 'fotile', '老板': 'robam', '华帝': 'vatti', '美的': 'midea',
  '海尔': 'haier', '万和': 'vanward', '万家乐': 'macro', '林内': 'noritz',
  '能率': 'noritz', 'A.O.史密斯': 'a_o_smith', '阿里斯顿': 'ariston',
  '博世': 'bosch', '西门子': 'siemens', '松下': 'panasonic', '伊莱克斯': 'electrolux',
  '帅康': 'sacon', '樱花': 'sakura', '康宝': 'canbo', '火王': 'firewang',
  '苏泊尔': 'supor', '九阳': 'joyoung', '爱仕达': 'asder',
};

// 分类映射（扩展）
const categoryMap: Record<string, string> = {
  // 厨卫
  '油烟机': 'range_hood',
  '燃气灶': 'gas_stove',
  '消毒柜': 'disinfection_cabinet',
  '热水器': 'water_heater',
  '洗碗机': 'dishwasher',
  '集成灶': 'integrated_stove',
  '微波炉': 'microwave',
  '蒸烤箱': 'steam_oven',
  // 大家电
  '冰箱': 'icebox',
  '洗衣机': 'washer',
  '电视': 'lcd_tv',
  '液晶电视': 'lcd_tv',
  // 小家电
  '净化器': 'jinghuaqi',
  '空气净化器': 'jinghuaqi',
};

export class PconlineKitchenClient {
  private baseUrl = 'https://kitchen.pconline.com.cn';
  private productBaseUrl = 'https://product.pconline.com.cn';
  private headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'identity', // 不压缩，避免编码问题
  };

  /**
   * 解码 GBK 编码
   */
  private async decodeGBK(buffer: ArrayBuffer): Promise<string> {
    try {
      const decoder = new TextDecoder('gbk');
      return decoder.decode(buffer);
    } catch {
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(buffer);
    }
  }

  /**
   * 获取厨卫产品列表
   */
  async getProductList(category: string = 'dishwasher', brand?: string, page: number = 1): Promise<{
    products: Array<{ id: string; url: string; name: string }>;
    total: number;
  }> {
    let url: string;

    if (brand) {
      url = `${this.productBaseUrl}/${category}/${brand}/list${page > 1 ? `_${page}s1` : ''}.shtml`;
    } else {
      url = `${this.productBaseUrl}/${category}/list${page > 1 ? `_${page}s1` : ''}.shtml`;
    }

    try {
      const response = await fetch(url, { headers: this.headers });
      const buffer = await response.arrayBuffer();
      const html = await this.decodeGBK(buffer);

      // 解析产品列表
      const products: Array<{ id: string; url: string; name: string }> = [];
      const regex = /href="[^"]*\/(\d+)_detail\.html"[^>]*>([^<]+)/g;
      let match;

      while ((match = regex.exec(html)) !== null) {
        products.push({
          id: match[1],
          url: `${this.productBaseUrl}/${category}/${brand || ''}/${match[1]}_detail.html`,
          name: match[2].trim(),
        });
      }

      // 如果没有找到详情页链接，尝试其他格式
      if (products.length === 0) {
        const altRegex = /href="[^"]*\/(\d+)\.html"[^>]*class="[^"]*pic[^"]*"[^>]*>([^<]*)/g;
        while ((match = altRegex.exec(html)) !== null) {
          products.push({
            id: match[1],
            url: `${this.productBaseUrl}/${category}/${brand || ''}/${match[1]}.html`,
            name: match[2].trim(),
          });
        }
      }

      return { products, total: products.length };
    } catch (error) {
      console.error('获取PConline厨卫产品列表失败:', error);
      return { products: [], total: 0 };
    }
  }

  /**
   * 获取产品详情
   */
  async getProductDetail(productId: string, category: string = 'dishwasher'): Promise<PconlineKitchenProduct | null> {
    const url = `${this.productBaseUrl}/${category}/${productId}_detail.html`;

    try {
      const response = await fetch(url, { headers: this.headers });

      // 检查 HTTP 状态码
      if (response.status === 503 || response.status === 429) {
        console.log(`   ⚠️ 被限流 (${response.status}): ${productId}`);
        return null;
      }

      const buffer = await response.arrayBuffer();
      const html = await this.decodeGBK(buffer);

      // 检查页面内容是否有效
      if (html.includes('503') || html.includes('Too many requests') || html.length < 1000) {
        console.log(`   ⚠️ 无效页面: ${productId}`);
        return null;
      }

      return this.parseProductDetail(html, productId, url, category);
    } catch (error) {
      console.error(`获取PConline产品详情失败 [${productId}]:`, error);
      return null;
    }
  }

  /**
   * 解析产品详情页
   */
  private parseProductDetail(html: string, productId: string, sourceUrl: string, category: string): PconlineKitchenProduct | null {
    // 检查页面是否有效
    if (html.includes('页面已删除') || html.includes('页面走丢了') || html.includes('404')) {
      return null;
    }

    // 提取产品名称
    const nameMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/) ||
                      html.match(/<title[^>]*>([^<|]+)/);
    const name = nameMatch ? nameMatch[1].trim() : '';

    // 验证产品名称有效性
    if (!name) return null;
    if (name.includes('503') || name.includes('Too many')) return null;
    if (name.includes('太平洋电脑网') || name.includes('pconline')) return null;
    if (name.includes('页面已删除') || name.includes('页面走丢了') || name.includes('404')) return null;
    if (name.length < 3) return null;

    // 提取品牌
    const brandMatch = html.match(/品牌[^<]*<[^>]*>([^<]+)/) ||
                       html.match(/品牌：<\/th>\s*<td[^>]*>([^<]+)/);
    const brandCn = brandMatch ? brandMatch[1].trim() : '';
    const brand = brandMap[brandCn] || brandCn.toLowerCase();

    // 提取型号
    const modelMatch = html.match(/型号[^<]*<[^>]*>([^<]+)/) ||
                       html.match(/型号：<\/th>\s*<td[^>]*>([^<]+)/);
    const model = modelMatch ? modelMatch[1].trim() : '';

    // 提取图片
    const images: string[] = [];
    const imgRegex = /src="(https?:\/\/[^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/gi;
    let imgMatch;
    while ((imgMatch = imgRegex.exec(html)) !== null) {
      if (imgMatch[1].includes('pconline.com.cn') && !imgMatch[1].includes('icon') && !imgMatch[1].includes('logo')) {
        images.push(imgMatch[1]);
      }
    }

    // 提取参数
    const params: Record<string, string> = {};
    const paramRegex = /<th[^>]*>([^<]+)<\/th>\s*<td[^>]*>([^<]+)<\/td>/g;
    let paramMatch;
    while ((paramMatch = paramRegex.exec(html)) !== null) {
      const key = paramMatch[1].trim();
      const value = paramMatch[2].trim();
      if (key && value && key !== '图片' && key !== '外观') {
        params[key] = value;
      }
    }

    // 提取价格
    const priceMatch = html.match(/¥([\d,.]+)/) ||
                       html.match(/价格[^<]*<[^>]*>([\d,.]+)/);
    const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : null;

    return {
      id: productId,
      name,
      brand,
      model,
      category: categoryMap[category] || category,
      images: [...new Set(images)].slice(0, 10),
      params,
      price,
      source_url: sourceUrl,
      source_platform: 'pconline',
    };
  }

  /**
   * 批量获取产品
   */
  async batchGetProducts(ids: string[], category: string = 'dishwasher'): Promise<PconlineKitchenProduct[]> {
    const results: PconlineKitchenProduct[] = [];

    for (const id of ids) {
      const product = await this.getProductDetail(id, category);
      if (product) {
        results.push(product);
      }
      // 限流
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return results;
  }
}

export default new PconlineKitchenClient();
