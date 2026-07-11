/**
 * 填充产品拼音数据
 * 用于拼音搜索支持
 */
import pg from 'pg';
import { pinyin } from 'pinyin-pro';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'appliance_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres123',
});

/**
 * 判断是否为中文字符
 */
function isChinese(char: string): boolean {
  const code = char.charCodeAt(0);
  return code >= 0x4e00 && code <= 0x9fff;
}

/**
 * 去除拼音中的声调字符
 * 例如: "hě" → "h", "ā á ǎ à" → "a"
 */
function stripToneMarks(text: string): string {
  // 声调字符到基础字符的映射
  const toneMap: Record<string, string> = {
    'ā': 'a', 'á': 'a', 'ǎ': 'a', 'à': 'a',
    'ē': 'e', 'é': 'e', 'ě': 'e', 'è': 'e',
    'ī': 'i', 'í': 'i', 'ǐ': 'i', 'ì': 'i',
    'ō': 'o', 'ó': 'o', 'ǒ': 'o', 'ò': 'o',
    'ū': 'u', 'ú': 'u', 'ǔ': 'u', 'ù': 'u',
    'ǖ': 'v', 'ǘ': 'v', 'ǚ': 'v', 'ǜ': 'v', 'ü': 'v',
  };
  return text.split('').map(c => toneMap[c] || c).join('');
}

/**
 * 将文本转换为拼音（只转换中文字符，保留英文/数字原样）
 * 例如: "hisense 海尔BCD" → "hisense haierBCD"
 */
function toPinyin(text: string): string {
  if (!text) return '';
  let result = '';
  let chineseBuffer = '';

  for (const char of text) {
    if (isChinese(char)) {
      chineseBuffer += char;
    } else {
      // 遇到非中文字符，先处理缓冲区的中文
      if (chineseBuffer) {
        result += pinyin(chineseBuffer, { toneType: 'none' });
        chineseBuffer = '';
      }
      result += char;
    }
  }
  // 处理最后的中文缓冲区
  if (chineseBuffer) {
    result += pinyin(chineseBuffer, { toneType: 'none' });
  }

  return result;
}

/**
 * 将文本转换为拼音首字母（只转换中文字符）
 * 例如: "hisense 海尔BCD" → "hisense hBCD"
 */
function toPinyinInitials(text: string): string {
  if (!text) return '';
  let result = '';
  let chineseBuffer = '';

  for (const char of text) {
    if (isChinese(char)) {
      chineseBuffer += char;
    } else {
      if (chineseBuffer) {
        const initials = pinyin(chineseBuffer, { pattern: 'first', type: 'array' });
        result += stripToneMarks(initials.join(''));
        chineseBuffer = '';
      }
      result += char;
    }
  }
  if (chineseBuffer) {
    const initials = pinyin(chineseBuffer, { pattern: 'first', type: 'array' });
    result += stripToneMarks(initials.join(''));
  }

  return result;
}

async function fillPinyin() {
  try {
    console.log('连接数据库...');
    await pool.query('SELECT 1');
    console.log('数据库连接成功');

    // 获取所有产品
    const result = await pool.query('SELECT id, name, brand FROM products');
    console.log(`共 ${result.rows.length} 个产品`);

    let updated = 0;
    for (const product of result.rows) {
      const searchText = `${product.brand} ${product.name}`;
      const pinyinValue = toPinyin(searchText);
      const initialsValue = toPinyinInitials(searchText);

      await pool.query(
        'UPDATE products SET pinyin = $1, pinyin_initials = $2 WHERE id = $3',
        [pinyinValue, initialsValue, product.id]
      );

      updated++;
      if (updated % 50 === 0) {
        console.log(`  已处理 ${updated}/${result.rows.length}`);
      }
    }

    console.log(`\n完成！已更新 ${updated} 个产品的拼音数据`);

    // 验证
    console.log('\n=== 验证示例 ===');
    const samples = await pool.query(`
      SELECT name, brand, pinyin, pinyin_initials
      FROM products
      WHERE name LIKE '%海尔%' OR name LIKE '%美的%' OR name LIKE '%格力%'
      LIMIT 5
    `);
    samples.rows.forEach(r => {
      console.log(`  ${r.brand} - ${r.name}`);
      console.log(`    拼音: ${r.pinyin}`);
      console.log(`    首字母: ${r.pinyin_initials}`);
    });

    // 测试拼音搜索
    console.log('\n=== 测试拼音搜索 "gl" ===');
    const t1 = await pool.query(`
      SELECT name, brand FROM products WHERE pinyin_initials ILIKE '%gl%' LIMIT 5
    `);
    t1.rows.forEach(r => console.log(`  ${r.brand} - ${r.name}`));

    console.log('\n=== 测试拼音搜索 "hxr" ===');
    const t2 = await pool.query(`
      SELECT name, brand FROM products WHERE pinyin_initials ILIKE '%hxr%' LIMIT 5
    `);
    t2.rows.forEach(r => console.log(`  ${r.brand} - ${r.name}`));

    console.log('\n=== 测试拼音搜索 "mde" ===');
    const t3 = await pool.query(`
      SELECT name, brand FROM products WHERE pinyin_initials ILIKE '%mde%' LIMIT 5
    `);
    t3.rows.forEach(r => console.log(`  ${r.brand} - ${r.name}`));

  } catch (error) {
    console.error('填充拼音失败:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fillPinyin();
