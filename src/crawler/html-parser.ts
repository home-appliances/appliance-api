/**
 * HTML 解析器
 * 用于解析 PConline 产品页面
 */

import { ProductList } from './types';
import { stripHtmlTags, cleanText } from './utils';

// =====================================================
// 解析产品列表
// =====================================================
export function parseProductList(html: string, brand: string, category: string = 'icebox'): ProductList {
  const products: Array<{ id: string; name: string; url: string }> = [];

  // 匹配产品链接
  // 格式: href="//product.pconline.com.cn/icebox/haier/2753199.html"
  // 或: href="//product.pconline.com.cn/air_condition/gree/1234567.html"
  const regex = new RegExp(
    `href="//product\\.pconline\\.com\\.cn/${category}/${brand}/(\\d+)\\.html"[^>]*>([^<]+)<`,
    'g'
  );

  let match;
  const seenIds = new Set<string>();

  while ((match = regex.exec(html)) !== null) {
    const id = match[1];
    const name = cleanText(stripHtmlTags(match[2]));

    // 去重
    if (!seenIds.has(id) && name) {
      seenIds.add(id);
      products.push({
        id,
        name,
        url: `//product.pconline.com.cn/${category}/${brand}/${id}.html`,
      });
    }
  }

  // 解析下一页 cursor
  // 格式1: href="/icebox/haier/list_25s1.shtml" (相对路径，实际格式)
  // 格式2: href="//product.pconline.com.cn/icebox/haier/25s1.shtml" (绝对路径)
  const nextCursorRegex = new RegExp(
    `href="(/${category}/${brand}/[^"]*\\.shtml)"[^>]*>下一页`,
    'g'
  );
  let nextMatch = nextCursorRegex.exec(html);

  // 备选：绝对路径格式
  if (!nextMatch) {
    const altRegex = new RegExp(
      `href="(//product\\.pconline\\.com\\.cn/${category}/${brand}/[^"]*\\.shtml)"[^>]*>下一页`,
      'g'
    );
    nextMatch = altRegex.exec(html);
  }

  return {
    products,
    nextCursor: nextMatch ? nextMatch[1] : undefined,
  };
}

// =====================================================
// 解析产品参数
// =====================================================
export function parseProductParams(html: string): Record<string, any> {
  const params: Record<string, any> = {};

  // 匹配参数表格
  // 格式:
  // <tr class="" itemid="24596264">
  //   <th>型号</th>
  //   <td>BCD-502WGHTD1CDWU1</td>
  // </tr>
  const regex = /<tr[^>]*itemid="\d+"[^>]*>\s*<th>([^<]+)<\/th>\s*<td>\s*([\s\S]*?)\s*<\/td>\s*<\/tr>/g;

  let match;
  while ((match = regex.exec(html)) !== null) {
    const key = cleanText(stripHtmlTags(match[1]));
    let value = cleanText(stripHtmlTags(match[2]));

    // 移除价格相关的 HTML
    value = value.replace(/<[^>]*>/g, '').trim();

    // 清理推广文本：去掉 "• xxx是什么• 查看所有xxx" 等内容
    // 例如: "R600a• R600a是什么• 查看所有R600a海尔(Haier)" -> "R600a"
    value = value.replace(/•.*$/, '').trim();

    if (key && value) {
      params[key] = value;
    }
  }

  // 如果没有匹配到参数，尝试另一种格式
  if (Object.keys(params).length === 0) {
    const alternativeRegex = /<th>([^<]+)<\/th>\s*<td>\s*([\s\S]*?)\s*<\/td>/g;
    while ((match = alternativeRegex.exec(html)) !== null) {
      const key = cleanText(stripHtmlTags(match[1]));
      let value = cleanText(stripHtmlTags(match[2]));

      // 清理推广文本
      value = value.replace(/•[^•]*$/, '').trim();

      if (key && value && !params[key]) {
        params[key] = value;
      }
    }
  }

  return params;
}

// =====================================================
// 解析产品名称
// =====================================================
export function parseProductName(html: string): string | null {
  // 匹配 <h1> 标签中的产品名称
  const regex = /<h1[^>]*>([^<]+)<\/h1>/;
  const match = regex.exec(html);
  return match ? cleanText(stripHtmlTags(match[1])) : null;
}

// =====================================================
// 解析产品图片
// =====================================================
export function parseProductImages(html: string): string[] {
  const images: string[] = [];
  const seenUrls = new Set<string>();

  // 匹配产品主图
  // 格式: #src="//img4.pconline.com.cn/pconline/images/product/xxx.jpg"
  const regex = /#src="(\/\/[^"]*pconline\/images\/product\/[^"]*\.(jpg|jpeg|png|webp))"/gi;

  let match;
  while ((match = regex.exec(html)) !== null) {
    let url = match[1];

    // 补全协议
    if (url.startsWith('//')) {
      url = 'https:' + url;
    }

    // 去掉各种后缀获取高清原图
    // 例如: xxx_cn.jpg -> xxx.jpg
    // 例如: xxx_120x90.jpg -> xxx.jpg
    // 例如: xxx_thumb.jpg -> xxx.jpg
    url = url.replace(/_(cn|thumb|\d+x\d+)\.(jpg|jpeg|png|webp)$/i, '.$2');

    // 跳过太小的缩略图（URL中包含尺寸的）
    if (url.includes('_120x90') || url.includes('_80x60')) {
      continue;
    }

    // 去重
    if (!seenUrls.has(url)) {
      seenUrls.add(url);
      images.push(url);
    }
  }

  // 如果没有找到产品主图，尝试匹配其他格式
  if (images.length === 0) {
    // 匹配京东图片
    const jdRegex = /src="(https?:\/\/img14\.360buyimg\.com\/[^"]*\.(jpg|jpeg|png|webp))"/gi;
    while ((match = jdRegex.exec(html)) !== null) {
      const url = match[1];
      if (!seenUrls.has(url)) {
        seenUrls.add(url);
        images.push(url);
      }
    }
  }

  // 匹配产品图片库的图片
  // 格式: src="//img0.pconline.com.cn/pconline/xxx_thumb.jpg"
  const galleryRegex = /src="(\/\/img[0-9]*\.pconline\.com\.cn\/pconline\/[^"]*\.(jpg|jpeg|png|webp))"/gi;
  while ((match = galleryRegex.exec(html)) !== null) {
    let url = match[1];

    // 补全协议
    if (url.startsWith('//')) {
      url = 'https:' + url;
    }

    // 去掉各种后缀获取高清原图
    // 例如: xxx_cn.jpg -> xxx.jpg
    // 例如: xxx_thumb.jpg -> xxx.jpg
    // 例如: xxx_120x90.jpg -> xxx.jpg
    url = url.replace(/_(cn|thumb|\d+x\d+)\.(jpg|jpeg|png|webp)$/i, '.$2');

    // 跳过太小的缩略图（URL中包含尺寸的）
    if (url.includes('_120x90') || url.includes('_80x60')) {
      continue;
    }

    // 去重
    if (!seenUrls.has(url)) {
      seenUrls.add(url);
      images.push(url);
    }
  }

  return images;
}

// =====================================================
// 解析产品价格
// =====================================================
export function parseProductPrice(html: string): number | null {
  // 匹配价格
  // 格式: <a href="...">¥8799.0</a>
  const regex = /¥\s*(\d+(?:\.\d+)?)/;
  const match = regex.exec(html);
  return match ? parseFloat(match[1]) : null;
}

// =====================================================
// 解析产品评分
// =====================================================
export function parseProductRating(html: string): number | null {
  // 匹配评分
  // 格式: <span class="score">4.5</span>
  const regex = /<span[^>]*class="[^"]*score[^"]*"[^>]*>(\d+(?:\.\d+)?)<\/span>/;
  const match = regex.exec(html);
  return match ? parseFloat(match[1]) : null;
}

// =====================================================
// 检查是否有下一页
// =====================================================
export function hasNextPage(html: string, brand: string): boolean {
  const regex = new RegExp(
    `href="//product\\.pconline\\.com\\.cn/icebox/${brand}/[^"]*\\.shtml"[^>]*>下一页`,
    'g'
  );
  return regex.test(html);
}

// =====================================================
// 提取产品 ID 列表
// =====================================================
export function extractProductIds(html: string, brand: string): string[] {
  const ids: string[] = [];
  const seenIds = new Set<string>();

  const regex = new RegExp(
    `href="//product\\.pconline\\.com\\.cn/icebox/${brand}/(\\d+)\\.html"`,
    'g'
  );

  let match;
  while ((match = regex.exec(html)) !== null) {
    const id = match[1];
    if (!seenIds.has(id)) {
      seenIds.add(id);
      ids.push(id);
    }
  }

  return ids;
}
