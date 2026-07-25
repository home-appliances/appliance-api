/**
 * 数据库初始化种子脚本
 * 灌入初始数据: 分类、管理员、品类参数规范
 *
 * 用法: npm run db:seed
 * 重复执行安全(ON CONFLICT 跳过)
 * 空调参数以 snapshots/category-params-air-condition.json 为准（与现网 ETL 规范对齐）
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'appliance_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres123',
});

type SnapshotRow = {
  param_key: string;
  display_name: string;
  icon: string | null;
  param_type: string;
  is_core: boolean;
  is_filter: boolean;
  is_sortable: boolean;
  enum_values: string[] | null;
  sort_order: number;
};

async function upsertParam(
  client: pg.PoolClient,
  catCode: string,
  key: string,
  display: string,
  icon: string | null,
  type: string,
  core: boolean,
  filter: boolean,
  sortable: boolean,
  enums: string[] | null,
  order: number
) {
  await client.query(
    `
    INSERT INTO category_params (category_id, param_key, display_name, icon, param_type, is_core, is_filter, is_sortable, enum_values, sort_order)
    SELECT c.id, $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9
    FROM categories c WHERE c.code = $10
    ON CONFLICT (category_id, param_key) DO NOTHING
  `,
    [
      key,
      display,
      icon,
      type,
      core,
      filter,
      sortable,
      enums == null ? null : JSON.stringify(enums),
      order,
      catCode,
    ]
  );
}

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🌱 开始灌入初始数据...\n');

    console.log('📂 分类...');
    await client.query(`
      INSERT INTO categories (code, name, display_name, icon, sort_order) VALUES
        ('air_condition', '空调', '空调', '❄️', 1),
        ('icebox', '冰箱', '冰箱', '🧊', 2),
        ('washer', '洗衣机', '洗衣机', '👕', 3),
        ('gas_water', '燃气热水器', '燃气热水器', '🔥', 4),
        ('central_water', '中央热水器', '中央热水器', '♨️', 5),
        ('heater', '取暖器', '取暖器', '🌡️', 6),
        ('lcd_tv', '液晶电视', '电视', '📺', 7),
        ('rice_cooker', '电饭煲', '电饭煲', '🍚', 8),
        ('dishwasher', '洗碗机', '洗碗机', '🍽️', 9),
        ('washer_dryer', '洗烘一体机', '洗烘一体机', '🌀', 10),
        ('freezer', '冷柜', '冷柜', '❄️', 11),
        ('range_hood', '油烟机', '油烟机', '💨', 12),
        ('gas_stove', '燃气灶', '燃气灶', '🔥', 13),
        ('microwave', '微波炉', '微波炉', '📡', 14),
        ('oven', '烤箱', '烤箱', '🥐', 15),
        ('air_fryer', '空气炸锅', '空气炸锅', '🍟', 16)
      ON CONFLICT (code) DO NOTHING
    `);
    console.log('  ✅ 16 个分类');

    console.log('👤 管理员...');
    const passwordHash = await bcrypt.hash('admin123', 10);
    await client.query(
      `
      INSERT INTO admins (username, password_hash, name, role, status)
      VALUES ('admin', $1, '系统管理员', 'super_admin', 'active')
      ON CONFLICT (username) DO NOTHING
    `,
      [passwordHash]
    );
    console.log('  ✅ admin / admin123');

    console.log('⚙️  品类参数规范...');
    let paramCount = 0;

    const snapPath = path.join(__dirname, 'snapshots', 'category-params-air-condition.json');
    const acRows = JSON.parse(fs.readFileSync(snapPath, 'utf-8')) as SnapshotRow[];
    for (const r of acRows) {
      await upsertParam(
        client,
        'air_condition',
        r.param_key,
        r.display_name,
        r.icon,
        r.param_type || 'text',
        !!r.is_core,
        !!r.is_filter,
        !!r.is_sortable,
        r.enum_values,
        r.sort_order ?? 0
      );
      paramCount++;
    }
    console.log(`  ✅ 空调 ${acRows.length} 条（来自 snapshots/category-params-air-condition.json）`);

    const otherParams: Array<[string, string, string, string, string, boolean, boolean, boolean, string | null, number]> = [
      ['icebox', '总容积', '容积', '📦', 'number', true, true, true, null, 1],
      ['icebox', '制冷方式', '制冷', '❄️', 'enum', true, false, false, '["风冷","直冷","风直冷混合"]', 2],
      ['icebox', '能效等级', '能效', '🌿', 'enum', true, true, false, '["一级","二级","三级","四级","五级"]', 3],
      ['icebox', '门数', '门数', '🚪', 'enum', false, true, false, '["单门","双门","三门","对开门","多门"]', 4],
      ['washer', '洗涤容量', '容量', '👕', 'number', true, true, true, null, 1],
      ['washer', '能效等级', '能效', '🌿', 'enum', true, true, false, '["一级","二级","三级","四级","五级"]', 2],
      ['washer', '变频/定频', '变频', '💡', 'enum', false, true, false, '["变频","定频"]', 3],
      ['washer', '转速', '转速', '🔄', 'text', false, false, false, null, 4],
      ['range_hood', '排风量', '风量', '💨', 'number', true, true, true, null, 1],
      ['range_hood', '风压', '风压', '📊', 'number', true, false, true, null, 2],
      ['range_hood', '能效等级', '能效', '🌿', 'enum', true, true, false, '["一级","二级","三级"]', 3],
      ['range_hood', '噪音', '噪音', '🔊', 'text', false, false, false, null, 4],
      ['lcd_tv', '屏幕尺寸', '尺寸', '📺', 'number', true, true, true, null, 1],
      ['lcd_tv', '分辨率', '分辨率', '🖼️', 'enum', true, true, false, '["720P","1080P","4K","8K"]', 2],
      ['lcd_tv', '能效等级', '能效', '🌿', 'enum', true, true, false, '["一级","二级","三级"]', 3],
    ];

    for (const [catCode, key, display, icon, type, core, filter, sortable, enums, order] of otherParams) {
      await upsertParam(
        client,
        catCode,
        key,
        display,
        icon,
        type,
        core,
        filter,
        sortable,
        enums ? (JSON.parse(enums) as string[]) : null,
        order
      );
      paramCount++;
    }
    console.log(`  ✅ 其它品类 ${otherParams.length} 条`);
    console.log(`  ✅ 合计 ${paramCount} 条参数规范`);

    console.log('⚙️  系统设置...');
    await client.query(`
      INSERT INTO system_settings (key, value) VALUES
        ('basic', '{"systemName":"家电搜索后台","language":"zh-CN","timezone":"Asia/Shanghai"}'),
        ('security', '{"pwdMinLength":8,"sessionTimeout":60}'),
        ('data', '{"defaultPageSize":20}')
      ON CONFLICT (key) DO NOTHING
    `);
    console.log('  ✅ 默认设置');

    console.log('\n🎉 初始化完成!');
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((e) => {
  console.error('❌ 初始化失败:', e.message);
  process.exit(1);
});
