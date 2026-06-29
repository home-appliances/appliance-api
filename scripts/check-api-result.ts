import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const response = await fetch('http://localhost:3000/api/search?keyword=小米空调&page=1');
  const data = await response.json();

  console.log('搜索结果:');
  console.log('总数:', data.pagination?.total);
  console.log('');

  if (data.data && data.data.length > 0) {
    console.log('前5条:');
    for (let i = 0; i < Math.min(5, data.data.length); i++) {
      const item = data.data[i];
      console.log(`  ${i + 1}. [${item.id}] ${item.brand} - ${item.title}`);
    }
  }
}

main().catch(console.error);
