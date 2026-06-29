import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const tests = ['小米空调', '格力空调', '海尔冰箱', '美的洗衣机'];

  for (const keyword of tests) {
    const response = await fetch(`http://localhost:3000/api/search?keyword=${encodeURIComponent(keyword)}&page=1`);
    const data = await response.json();

    console.log(`搜索 "${keyword}": ${data.data?.length || 0} 条结果, 总数: ${data.pagination?.total || 0}`);

    if (data.data && data.data.length > 0) {
      console.log(`  第一条: ${data.data[0].title}`);
    }
    console.log('');
  }
}

main().catch(console.error);
