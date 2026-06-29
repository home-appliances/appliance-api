import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const tests = ['小米空调', '格力空调', '卡萨帝空调', '海尔冰箱', '美的洗衣机', '空调', '小米', '华凌空调'];

  for (const keyword of tests) {
    const response = await fetch(`http://localhost:3000/api/search?keyword=${encodeURIComponent(keyword)}&page=1`);
    const data = await response.json();

    console.log(`搜索 "${keyword}": ${data.data?.length || 0} 条, 总数: ${data.pagination?.total || 0}`);

    if (data.data && data.data.length > 0) {
      const first3 = data.data.slice(0, 3).map((d: any) => `${d.brand}-${d.title?.substring(0, 20)}`).join(', ');
      console.log(`  前3条: ${first3}`);
    }
    console.log('');
  }
}

main().catch(console.error);
