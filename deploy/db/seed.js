"use strict";
/**
 * 数据库初始化种子脚本
 * 灌入初始数据: 分类、管理员、品类参数规范
 *
 * 用法: npm run db:seed
 * 重复执行安全(ON CONFLICT 跳过)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = __importDefault(require("pg"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const pool = new pg_1.default.Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'appliance_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres123',
});
async function seed() {
    const client = await pool.connect();
    try {
        console.log('🌱 开始灌入初始数据...\n');
        // =====================================================
        // 1. 分类
        // =====================================================
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
        // =====================================================
        // 2. 管理员 (admin / admin123)
        // =====================================================
        console.log('👤 管理员...');
        const passwordHash = await bcryptjs_1.default.hash('admin123', 10);
        await client.query(`
      INSERT INTO admins (username, password_hash, name, role, status)
      VALUES ('admin', $1, '系统管理员', 'super_admin', 'active')
      ON CONFLICT (username) DO NOTHING
    `, [passwordHash]);
        console.log('  ✅ admin / admin123');
        // =====================================================
        // 3. 品类参数规范
        // =====================================================
        console.log('⚙️  品类参数规范...');
        const params = [
            // 空调
            ['air_condition', '匹数', '匹数', '⚡', 'enum', true, true, false, '["1匹","1.5匹","2匹","3匹","5匹"]', 1],
            ['air_condition', '能效等级', '能效', '🌿', 'enum', true, true, false, '["一级","二级","三级","四级","五级"]', 2],
            ['air_condition', '冷暖类型', '冷暖', '🔄', 'enum', true, false, false, '["冷暖","单冷","电辅热"]', 3],
            ['air_condition', '变频/定频', '变频', '💡', 'enum', false, true, false, '["变频","定频"]', 4],
            ['air_condition', '制冷量', '制冷量', '❄️', 'text', false, false, false, null, 5],
            ['air_condition', '适用面积', '面积', '📐', 'text', false, false, false, null, 6],
            // 冰箱
            ['icebox', '总容积', '容积', '📦', 'number', true, true, true, null, 1],
            ['icebox', '制冷方式', '制冷', '❄️', 'enum', true, false, false, '["风冷","直冷","风直冷混合"]', 2],
            ['icebox', '能效等级', '能效', '🌿', 'enum', true, true, false, '["一级","二级","三级","四级","五级"]', 3],
            ['icebox', '门数', '门数', '🚪', 'enum', false, true, false, '["单门","双门","三门","对开门","多门"]', 4],
            // 洗衣机
            ['washer', '洗涤容量', '容量', '👕', 'number', true, true, true, null, 1],
            ['washer', '能效等级', '能效', '🌿', 'enum', true, true, false, '["一级","二级","三级","四级","五级"]', 2],
            ['washer', '变频/定频', '变频', '💡', 'enum', false, true, false, '["变频","定频"]', 3],
            ['washer', '转速', '转速', '🔄', 'text', false, false, false, null, 4],
            // 油烟机
            ['range_hood', '排风量', '风量', '💨', 'number', true, true, true, null, 1],
            ['range_hood', '风压', '风压', '📊', 'number', true, false, true, null, 2],
            ['range_hood', '能效等级', '能效', '🌿', 'enum', true, true, false, '["一级","二级","三级"]', 3],
            ['range_hood', '噪音', '噪音', '🔊', 'text', false, false, false, null, 4],
            // 电视
            ['lcd_tv', '屏幕尺寸', '尺寸', '📺', 'number', true, true, true, null, 1],
            ['lcd_tv', '分辨率', '分辨率', '🖼️', 'enum', true, true, false, '["720P","1080P","4K","8K"]', 2],
            ['lcd_tv', '能效等级', '能效', '🌿', 'enum', true, true, false, '["一级","二级","三级"]', 3],
        ];
        for (const [catCode, key, display, icon, type, core, filter, sortable, enums, order] of params) {
            await client.query(`
        INSERT INTO category_params (category_id, param_key, display_name, icon, param_type, is_core, is_filter, is_sortable, enum_values, sort_order)
        SELECT c.id, $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9
        FROM categories c WHERE c.code = $10
        ON CONFLICT (category_id, param_key) DO NOTHING
      `, [key, display, icon, type, core, filter, sortable, enums, order, catCode]);
        }
        console.log(`  ✅ ${params.length} 条参数规范`);
        // =====================================================
        // 4. 系统设置
        // =====================================================
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
    }
    finally {
        client.release();
        await pool.end();
    }
}
seed().catch(e => {
    console.error('❌ 初始化失败:', e.message);
    process.exit(1);
});
