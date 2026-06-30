import AdmZip from 'adm-zip';
import { existsSync, rmSync, readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const ZIP_PATH = 'code.zip';

// 清理旧的 zip
if (existsSync(ZIP_PATH)) {
  rmSync(ZIP_PATH);
  console.log('🗑️  已删除旧的 code.zip');
}

// 读取根目录 package.json 的 dependencies
const rootPkg = JSON.parse(readFileSync('package.json', 'utf-8'));
const distPkg = {
  name: 'jd-appliance-api',
  version: '1.0.0',
  main: 'index.js',
  dependencies: rootPkg.dependencies || {}
};

// 写入 dist/package.json
writeFileSync('dist/package.json', JSON.stringify(distPkg, null, 2));
console.log('📝 已创建 dist/package.json');

// 安装生产依赖
console.log('📦 安装生产依赖...');
execSync('npm install --omit=dev', { cwd: 'dist', stdio: 'inherit' });

// 打包 dist 目录
const zip = new AdmZip();
zip.addLocalFolder('dist');
zip.writeZip(ZIP_PATH);

console.log('✅ 已打包 dist/ → code.zip');
