import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const response = await fetch('http://localhost:3000/api/search?keyword=空调&page=1');
  const data = await response.json();

  console.log('搜索结果数量:', data.data.length);
  console.log('\n前3条数据的图片:');

  for (let i = 0; i < 3; i++) {
    const item = data.data[i];
    console.log(`\n[${item.id}] ${item.title}`);
    console.log('img:', item.img ? item.img.substring(0, 80) + '...' : 'None');
    console.log('img长度:', item.img?.length || 0);
  }
}

main().catch(console.error);
