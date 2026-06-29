/** 修复10处残留脏值 (jsonb_set 用数组path) */
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const p = new pg.Pool({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});

const all = await p.query(`SELECT id, name FROM products WHERE category='air_condition'`);

const matches: {id:number, key:string, newVal:string}[] = [];

// 按产品名关键词匹配
const rules: [string, string, string][] = [
  ['奥克斯KFR-32GW/SFC', '循环风量', '207m³/h'],
  ['格力KFR-26GW/K(26556)', '室外机重量', '38.2kg'],
  ['格力KFR-72LW/(72518)', '制热量', '9610(900-11460)W'],
  ['格力KFR-72LW/(72518)', '制冷功率', '2125(300-3450)W'],
  ['格力KFR-72LW/(72518)', '制热功率', '3000(260-3980)W'],
  ['格力KFR-50LW/(50518)', '制热量', '7200(690-8200)W'],
  ['格力KFR-50LW/(50518)', '制冷功率', '1300(190-2500)W'],
  ['格力KFR-50LW/(50518)', '制热功率', '1980(190-2574)W'],
  ['长虹KFR-26GW/DHIK(W8-H)', '室内机尺寸', '790×270×205mm'],
  ['长虹KFR-35GW/Q5A', '室外机尺寸', '870×551×331mm'],
];

for (const row of all.rows) {
  const name: string = row.name || '';
  for (const [kw, key, newVal] of rules) {
    if (name.includes(kw)) {
      matches.push({id: row.id, key, newVal});
    }
  }
}

let ok = 0;
for (const m of matches) {
  try {
    const r = await p.query(
      `UPDATE products SET params = jsonb_set(params, $1::text[], $2::jsonb, false) WHERE id = $3`,
      [[m.key], JSON.stringify(m.newVal), m.id]
    );
    if (r.rowCount > 0) { ok++; console.log(`✓ ${m.id} ${m.key}=${m.newVal}`); }
  } catch(e) { console.log(`✗ ${m.id}: ${e}`); }
}
console.log(`\n修复 ${ok}/${matches.length} 处`);
await p.end();
