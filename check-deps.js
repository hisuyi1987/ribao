const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

// 必需的依赖包列表
const requiredDeps = {
  // 后端核心依赖
  'express': '^4.18.2',
  'axios': '^1.6.0',
  'body-parser': '^1.20.2',
  'cors': '^2.8.5',
  
  // 图片生成依赖（可选，如果装不上可以跳过）
  'canvas': '^2.11.2',
  
  // 开发依赖
  'nodemon': '^3.0.1'
};

// 检查依赖是否已安装
function checkDependency(packageName) {
  try {
    require.resolve(packageName);
    return true;
  } catch (e) {
    return false;
  }
}

// 安装依赖
function installDependency(packageName, version) {
  try {
    console.log(`正在安装 ${packageName}...`);
    execSync(`npm install ${packageName}@${version}`, { stdio: 'inherit' });
    console.log(`✅ ${packageName} 安装成功`);
    return true;
  } catch (error) {
    console.log(`❌ ${packageName} 安装失败: ${error.message}`);
    return false;
  }
}

// 主函数
function checkAndInstallDeps() {
  console.log('🔍 检查项目依赖...');
  
  const missingDeps = [];
  
  // 检查每个依赖
  for (const [pkg, version] of Object.entries(requiredDeps)) {
    if (!checkDependency(pkg)) {
      missingDeps.push({ name: pkg, version });
    } else {
      console.log(`✅ ${pkg} 已安装`);
    }
  }
  
  if (missingDeps.length === 0) {
    console.log('🎉 所有依赖都已安装完成！');
    return true;
  }
  
  console.log(`\n📦 发现 ${missingDeps.length} 个缺失依赖，开始安装...`);
  
  // 尝试安装缺失的依赖
  const failedDeps = [];
  for (const dep of missingDeps) {
    if (!installDependency(dep.name, dep.version)) {
      failedDeps.push(dep.name);
    }
  }
  
  if (failedDeps.length > 0) {
    console.log(`\n⚠️  以下依赖安装失败: ${failedDeps.join(', ')}`);
    console.log('💡 建议:');
    console.log('   1. 检查网络连接');
    console.log('   2. 尝试使用国内npm源: npm config set registry https://registry.npmmirror.com');
    console.log('   3. 如果是canvas安装失败，可以暂时跳过，使用jimp替代');
    return false;
  }
  
  console.log('\n🎉 所有依赖安装完成！');
  return true;
}

// 如果直接运行此脚本
if (require.main === module) {
  checkAndInstallDeps();
}

module.exports = { checkAndInstallDeps, checkDependency }; 