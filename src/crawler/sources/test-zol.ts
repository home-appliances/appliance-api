import { ZolClient } from './zol-client.js';

async function test() {
  const client = new ZolClient();
  const product = await client.getProductDetail('2109385');
  console.log(JSON.stringify(product, null, 2));
}

test().catch(e => console.error('Error:', e));
