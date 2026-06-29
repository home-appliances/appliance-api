/**
 * 数据库初始化脚本
 * 创建数据库和表结构
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

// 默认连接 postgres 数据库来创建新数据库
const defaultConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: 'postgres',  // 默认数据库
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
};

const TARGET_DB = process.env.DB_NAME || 'appliance_crawler';

/**
 * 创建数据库
 */
async function createDatabase(): Promise<void> {
  const pool = new Pool(defaultConfig);

  try {
    // 检查数据库是否已存在
    const checkResult = await pool.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [TARGET_DB]
    );

    if (checkResult.rows.length > 0) {
      console.log(`✅ 数据库 "${TARGET_DB}" 已存在`);
      return;
    }

    // 创建数据库（不能在事务中执行）
    await pool.query(`CREATE DATABASE "${TARGET_DB}"`);
    console.log(`✅ 数据库 "${TARGET_DB}" 创建成功`);
  } catch (error) {
    console.error('❌ 创建数据库失败:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

/**
 * 执行 SQL 文件
 */
async function executeSqlFile(sqlFilePath: string): Promise<void> {
  const pool = new Pool({
    ...defaultConfig,
    database: TARGET_DB,
  });

  try {
    const sql = fs.readFileSync(sqlFilePath, 'utf-8');
    await pool.query(sql);
    console.log(`✅ SQL 文件执行成功: ${path.basename(sqlFilePath)}`);
  } catch (error) {
    console.error(`❌ SQL 文件执行失败: ${path.basename(sqlFilePath)}`, error);
    throw error;
  } finally {
    await pool.end();
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始初始化数据库...\n');

  // 1. 创建数据库
  console.log('📦 步骤 1：创建数据库');
  await createDatabase();
  console.log('');

  // 2. 执行 schema.sql
  console.log('📦 步骤 2：创建表结构');
  const schemaPath = path.join(__dirname, 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    await executeSqlFile(schemaPath);
  } else {
    console.error('❌ schema.sql 文件不存在:', schemaPath);
    process.exit(1);
  }

  console.log('\n✅ 数据库初始化完成！');
  console.log(`\n📋 连接信息：`);
  console.log(`   主机: ${defaultConfig.host}`);
  console.log(`   端口: ${defaultConfig.port}`);
  console.log(`   数据库: ${TARGET_DB}`);
  console.log(`   用户: ${defaultConfig.user}`);
}

// 运行初始化
main().catch((error) => {
  console.error('初始化失败:', error);
  process.exit(1);
});
