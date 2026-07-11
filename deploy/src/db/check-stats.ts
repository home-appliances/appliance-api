import pg from 'pg';import dotenv from 'dotenv';dotenv.config();
const p=new pg.Pool({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
const d=await p.query(`SELECT count(*)::int as n FROM products CROSS JOIN LATERAL jsonb_each_text(params) AS e(k,v) WHERE category='air_condition' AND (v='0W' OR v~'^\\d\\.\\d+W$' OR v~'\\d{7,}')`);
const st=await p.query(`SELECT count(*)::int as total, count(image_id)::int as has_img FROM products WHERE category='air_condition'`);
const im=await p.query(`SELECT count(*)::int as n FROM images`);
console.log(`脏值: ${d.rows[0].n} 处`);
console.log(`图片: ${st.rows[0].has_img}/${st.rows[0].total} 有图`);
console.log(`images表: ${im.rows[0].n} 张`);
await p.end();
