const { checkAndInstallDeps } = require('./check-deps');

console.log('🚀 启动新闻图片生成系统...\n');

// 先检查并安装依赖
if (checkAndInstallDeps()) {
  console.log('\n✅ 依赖检查完成，启动服务器...\n');
  
  // 启动服务器
  try {
    require('./server');
  } catch (error) {
    console.error('❌ 服务器启动失败:', error.message);
    console.log('\n💡 请检查 server.js 文件是否存在且语法正确');
  }
} else {
  console.log('\n❌ 依赖安装失败，请手动安装依赖后重试');
  console.log('💡 运行命令: npm install');
} 