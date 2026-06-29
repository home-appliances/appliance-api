// 测试分词逻辑
const keyword = '卡萨帝空调';
const cleaned = keyword.replace(/[^一-龥a-zA-Z0-9]/g, ' ').trim();

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

console.log('输入:', keyword);
console.log('cleaned:', cleaned);
console.log('');

while (remaining.length > 0) {
  let matched = false;
  for (const word of allDictWords) {
    if (remaining.startsWith(word)) {
      terms.push(word);
      remaining = remaining.substring(word.length).trim();
      matched = true;
      console.log('匹配:', word, '→ 剩余:', remaining);
      break;
    }
  }
  if (!matched) {
    const nextWord = remaining.charAt(0);
    terms.push(nextWord);
    remaining = remaining.substring(1).trim();
    console.log('单字:', nextWord, '→ 剩余:', remaining);
  }
}

console.log('');
console.log('分词结果:', terms);

// 检查品牌映射
const brandMap: Record<string, string> = {
  '小米': 'xiaomi', '格力': 'gree', '海尔': 'haier', '美的': 'midea',
  '奥克斯': 'aux', '海信': 'hisense', 'tcl': 'tcl', '松下': 'panasonic',
  '大金': 'daikin', '三菱': 'mitsubishi', '科龙': 'kelon', '志高': 'chigo',
  '长虹': 'changhong', '扬子': 'yangzi', '惠而浦': 'whirlpool', '富士通': 'fujitsu',
  '日立': 'hitachi', '康佳': 'konka', '飞利浦': 'philips', '统帅': 'tongshuai',
  '米家': 'xiaomi', '华凌': 'midea', '卡萨帝': 'haier',
};

console.log('');
for (const term of terms) {
  const mapped = brandMap[term] || brandMap[term.toLowerCase()];
  console.log(`"${term}" → 品牌映射: ${mapped || '无'}`);
}
