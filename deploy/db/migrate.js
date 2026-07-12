"use strict";
/**
 * 数据库迁移脚本
 * 添加 category 字段到 products 表
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = __importDefault(require("pg"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const { Pool } = pg_1.default;
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'appliance_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
});
async function migrate() {
    const client = await pool.connect();
    try {
        // 检查 category 列是否已存在
        const checkResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'products' AND column_name = 'category'
    `);
        if (checkResult.rows.length === 0) {
            // 添加 category 列
            await client.query(`
        ALTER TABLE products
        ADD COLUMN category TEXT
      `);
            console.log('✅ 添加 category 列成功');
            // 为现有数据设置默认类别
            await client.query(`
        UPDATE products
        SET category = 'icebox'
        WHERE category IS NULL
      `);
            console.log('✅ 更新现有数据类别成功');
            // 添加索引
            await client.query(`
        CREATE INDEX IF NOT EXISTS idx_products_category ON products (category)
      `);
            console.log('✅ 添加 category 索引成功');
        }
        else {
            console.log('ℹ️ category 列已存在');
        }
        console.log('🎉 迁移完成');
    }
    catch (error) {
        console.error('❌ 迁移失败:', error);
        throw error;
    }
    finally {
        client.release();
        await pool.end();
    }
}
migrate();
