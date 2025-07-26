const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// 配置文件路径
const CONFIG_FILE = 'config.json';
const IMAGE_PATH = 'public/news-latest.png';

// 默认配置
const defaultConfig = {
  openai: {
    apiUrl: 'https://aihubmix.com/v1/chat/completions',
    apiKey: '',
    model: 'gpt-4o-mini'
  },
  keywords: ['科技', 'ai'],
  useMockData: false,
  imageStyle: {
    width: 600,
    height: 800,
    // 主标题设置
    mainTitle: '今日摸鱼见闻',
    titleFontSize: 28,
    titleColor: '#333333',
    titleY: 50, // 主标题Y坐标位置
    
    // 日期和关键词设置
    dateY: 80, // 日期Y坐标位置
    keywordsY: 110, // 关键词Y坐标位置
    
    // 正文设置
    fontSize: 16,
    textColor: '#666666',
    textStartY: 190, // 正文起始Y坐标
    lineHeight: 40, // 行高
    textLeftPadding: 60, // 左侧内边距
    
    // 背景设置
    backgroundColor: '#ffffff',
    backgroundImage: '',
    logoImage: ''
  }
};

// 确保目录存在
if (!fs.existsSync('public')) {
  fs.mkdirSync('public');
}

// 加载配置
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch (error) {
    console.error('加载配置失败:', error.message);
  }
  return defaultConfig;
}

// 保存配置
function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('保存配置失败:', error.message);
    return false;
  }
}

// 获取当前配置
let config = loadConfig();

// 模拟新闻数据
function getMockNewsData(keywords) {
  const mockData = {
    '科技': [
      '2025世界人工智能大会在沪开幕，聚焦AI前沿技术与产业趋势',
      '《中国智·惠世界(2025)》案例集发布，展现AI国际合作成果',
      '人工智能大会聚焦AI产业链创新，机器人现场表演',
      '高校加速布局未来赛道，智能+专业成新趋势',
      '得物人工智能查验系统获世界人工智能大会最高奖项"SAIL奖"'
    ],
    '社会': [
      '财政部：上半年财政运行总体平稳，社保就业支出增长9.2%',
      '保民生、促消费，财政政策有力度有温度',
      '北京希望"贡献中国智慧"，倡议成立世界人工智能合作组织',
      '中国倡议成立世界人工智能合作组织，贡献中国智慧',
      '7月26日五件财经大事抢先看'
    ],
    '财经': [
      '以太坊ETF资金净流入超越比特币，或成币圈新主导',
      '美股盘前：英特尔大跌8.7%，金价大跌美元走强',
      '净利润大跌22%！LVMH迎来"风浪时刻"',
      '2025年07月26日第4版：财经新闻 - 上海证券报',
      '喜娜AI速递：今日财经热点要闻回顾'
    ]
  };
  
  const allNews = [];
  keywords.forEach(keyword => {
    if (mockData[keyword]) {
      allNews.push(...mockData[keyword]);
    }
  });
  
  // 返回10条新闻
  return allNews.slice(0, 10);
}

// 调用AI API获取新闻
async function getNewsFromOpenAI(keywords) {
  try {
    console.log('   - 准备调用AI API，关键词:', keywords);
    console.log('   - API地址:', config.openai.apiUrl);
    console.log('   - 模型:', config.openai.model);
    
    // 检查是否使用模拟数据模式
    if (config.useMockData) {
      console.log('   - 使用模拟数据模式');
      return getMockNewsData(keywords);
    }
    
    const prompt = `请搜索今天与以下关键词相关的新闻，返回5-10条新闻标题，格式为JSON数组：
关键词：${keywords.join('、')}

要求：
1. 只返回新闻标题
2. 每条标题不超过50字
3. 返回格式：[{"title": "新闻标题1"}, {"title": "新闻标题2"}]`;

    console.log('   - 发送请求到AI API...');
    
    // 根据API提供商选择不同的请求格式
    let requestData;
    let headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };
    let apiUrl = config.openai.apiUrl; // 默认使用配置的URL
    
    if (config.openai.apiUrl.includes('aihubmix.com')) {
      // aihubmix.com format
      requestData = {
        model: config.openai.model,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 1000,
        web_search_options: {}
      };
      headers['Authorization'] = `Bearer ${config.openai.apiKey}`;
    } else {
      // Standard OpenAI format
      requestData = {
        model: config.openai.model,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7,
        stream: false
      };
      headers['Authorization'] = `Bearer ${config.openai.apiKey}`;
    }
    
    const response = await axios.post(apiUrl || config.openai.apiUrl, requestData, { headers });

    // 适配不同的响应格式
    let content;
    console.log('API响应数据:', JSON.stringify(response.data, null, 2));
    
    if (response.data.choices && response.data.choices[0]) {
      content = response.data.choices[0].message.content;
    } else if (response.data.content) {
      content = response.data.content;
    } else if (response.data.text) {
      content = response.data.text;
    } else if (response.data.response) {
      content = response.data.response;
    } else if (response.data.output) {
      content = response.data.output;
    } else {
      content = JSON.stringify(response.data);
    }
    
    // 尝试解析JSON
    try {
      const newsData = JSON.parse(content);
      return newsData.map(item => item.title);
    } catch (parseError) {
      console.log('JSON解析失败，尝试其他方式提取新闻标题...');
      
      // 如果JSON解析失败，尝试从HTML或文本中提取标题
      if (content.includes('<') && content.includes('>')) {
        // 如果是HTML格式，尝试提取文本内容
        console.log('检测到HTML格式，尝试提取文本...');
        const textContent = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        
        // 尝试从文本中提取新闻标题
        const lines = textContent.split(/[。！？\n]/).filter(line => line.trim().length > 5);
        return lines.slice(0, 10); // 返回前10行作为新闻标题
      } else {
        // 如果是纯文本，按行分割
        const lines = content.split(/[。！？\n]/).filter(line => line.trim().length > 5);
        return lines.slice(0, 10);
      }
    }
  } catch (error) {
    console.error('调用AI API失败:', error.message);
    console.error('错误详情:', error.response?.data || error);
    throw new Error('获取新闻失败');
  }
}

// 生成图片（使用Canvas生成PNG）
async function generateNewsImage(newsTitles) {
  try {
    console.log('3. 开始生成图片...');
    
    // 检查Canvas模块是否可用
    try {
      const { createCanvas, loadImage, registerFont } = require('canvas');
      console.log('✅ Canvas模块加载成功，将生成PNG图片');
      console.log('Canvas版本:', require('canvas').version);
      
      // 从配置中获取图片样式
      const imageStyle = config.imageStyle || defaultConfig.imageStyle;
      
      // 创建Canvas
      const canvas = createCanvas(imageStyle.width, imageStyle.height);
      const ctx = canvas.getContext('2d');
      console.log(`创建Canvas，尺寸: ${imageStyle.width} x ${imageStyle.height}`);
      
      // 设置背景色
      ctx.fillStyle = imageStyle.backgroundColor;
      ctx.fillRect(0, 0, imageStyle.width, imageStyle.height);
      console.log(`设置背景色: ${imageStyle.backgroundColor}`);
      
      // 如果有背景图，加载并绘制
      if (imageStyle.backgroundImage) {
        try {
          console.log(`加载背景图片: ${imageStyle.backgroundImage}`);
          const backgroundImage = await loadImage(imageStyle.backgroundImage);
          ctx.drawImage(backgroundImage, 0, 0, imageStyle.width, imageStyle.height);
        } catch (imgErr) {
          console.error('背景图片加载失败:', imgErr.message);
        }
      }
      
      // 设置字体
      const titleFont = `bold ${imageStyle.titleFontSize}px "Noto Sans CJK SC", "WenQuanYi Micro Hei", "Microsoft YaHei", "DejaVu Sans", Arial, sans-serif`;
      const normalFont = `${imageStyle.fontSize}px "Noto Sans CJK SC", "WenQuanYi Micro Hei", "Microsoft YaHei", "DejaVu Sans", Arial, sans-serif`;
      
      // 绘制主标题
      ctx.font = titleFont;
      ctx.fillStyle = imageStyle.titleColor;
      ctx.textAlign = 'center';
      ctx.fillText(imageStyle.mainTitle, imageStyle.width / 2, imageStyle.titleY);
      
      // 绘制日期
      const today = new Date();
      const dateStr = `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`;
      ctx.font = `${imageStyle.fontSize}px "Noto Sans CJK SC", "WenQuanYi Micro Hei", "Microsoft YaHei", "DejaVu Sans", Arial, sans-serif`;
      ctx.fillText(dateStr, imageStyle.width / 2, imageStyle.dateY);
      
      // 绘制关键词
      ctx.fillText(`关键词: ${config.keywords.join('、')}`, imageStyle.width / 2, imageStyle.keywordsY);
      
      // 绘制分隔线
      ctx.beginPath();
      ctx.moveTo(50, imageStyle.keywordsY + 20);
      ctx.lineTo(imageStyle.width - 50, imageStyle.keywordsY + 20);
      ctx.strokeStyle = '#cccccc';
      ctx.stroke();
      
      // 绘制新闻标题列表
      ctx.font = normalFont;
      ctx.fillStyle = imageStyle.textColor;
      ctx.textAlign = 'left';
      
      // 绘制新闻标题前的提示文字
      ctx.fillText(`以下是与 "${config.keywords.join('、')}" 相关的新闻标题:`, imageStyle.textLeftPadding, imageStyle.textStartY - imageStyle.lineHeight);
      
      // 逐条绘制新闻标题
      let y = imageStyle.textStartY;
      for (let i = 0; i < newsTitles.length && i < 10; i++) {
        let title = newsTitles[i];
        
        // 清理标题文本，移除JSON格式
        if (typeof title === 'string') {
          try {
            // 尝试解析JSON字符串
            if (title.includes('{"title":')) {
              const match = title.match(/"title":\s*"([^"]+)"/);
              if (match && match[1]) {
                title = match[1];
              }
            }
          } catch (e) {
            // 解析失败，保持原样
          }
        }
        
        // 限制标题长度
        if (title.length > 40) {
          title = title.substring(0, 40) + '...';
        }
        
        // 绘制序号和标题
        ctx.fillText(`${i + 1}. ${title}`, imageStyle.textLeftPadding, y);
        y += imageStyle.lineHeight; // 行距
      }
      
      // 如果有Logo图片，加载并绘制
      if (imageStyle.logoImage) {
        try {
          const logoImage = await loadImage(imageStyle.logoImage);
          const logoSize = 80;
          ctx.drawImage(logoImage, imageStyle.width - logoSize - 20, imageStyle.height - logoSize - 20, logoSize, logoSize);
        } catch (imgErr) {
          console.error('Logo图片加载失败:', imgErr.message);
        }
      }
      
      // 保存图片
      console.log('开始生成PNG图片...');
      const fs = require('fs');
      const path = require('path');
      
      // 确保目录存在
      if (!fs.existsSync('public')) {
        fs.mkdirSync('public');
      }
      
      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(path.join('public', 'news-latest.png'), buffer);
      console.log(`PNG图片生成完成，大小: ${buffer.length} 字节`);
      console.log(`PNG图片已保存到 public/news-latest.png`);
      
      return 'news-latest.png';
    } catch (canvasErr) {
      console.error('Canvas模块加载失败，将生成HTML:', canvasErr.message);
      // 如果Canvas不可用，回退到生成HTML
      return generateNewsHTML(newsTitles);
    }
  } catch (error) {
    console.error('生成图片失败:', error);
    throw new Error('生成图片失败');
  }
}

// 备用HTML生成方法
function generateHTMLImage(newsTitles, keywords) {
  const today = new Date().toLocaleDateString('zh-CN');
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      margin: 0;
      padding: 20px;
      font-family: 'Microsoft YaHei', Arial, sans-serif;
      background: ${config.imageStyle.backgroundColor};
      color: ${config.imageStyle.textColor};
    }
    .container {
      width: ${config.imageStyle.width}px;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .title {
      font-size: 28px;
      font-weight: bold;
      color: ${config.imageStyle.titleColor};
      margin-bottom: 10px;
    }
    .date {
      font-size: 16px;
      color: ${config.imageStyle.textColor};
      margin-bottom: 20px;
    }
    .keywords {
      font-size: 18px;
      color: ${config.imageStyle.titleColor};
      margin-bottom: 20px;
    }
    .news-list {
      list-style: none;
      padding: 0;
    }
    .news-item {
      font-size: ${config.imageStyle.fontSize}px;
      line-height: 1.6;
      margin-bottom: 15px;
      padding: 10px;
      border-left: 3px solid #1890ff;
      background: #f8f9fa;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="title">今日热榜新闻</div>
      <div class="date">${today}</div>
      <div class="keywords">关键词：${keywords.join('、')}</div>
    </div>
    <ul class="news-list">
      ${newsTitles.map((title, index) => `
        <li class="news-item">${index + 1}. ${title}</li>
      `).join('')}
    </ul>
  </div>
</body>
</html>`;

  // 保存HTML文件
  fs.writeFileSync('public/news-latest.html', html);
  
  return 'news-latest.html';
}

// API路由：生成新闻图片
app.get('/api/news-image', async (req, res) => {
  try {
    console.log('=== 开始处理新闻图片生成请求 ===');
    console.log('当前配置:', JSON.stringify(config, null, 2));
    
    // 获取新闻
    console.log('1. 开始调用AI API获取新闻...');
    const newsTitles = await getNewsFromOpenAI(config.keywords);
    console.log('2. AI API调用完成，获取到', newsTitles.length, '条新闻');
    console.log('新闻标题:', newsTitles);
    
    // 生成图片
    console.log('3. 开始生成图片...');
    const imagePath = await generateNewsImage(newsTitles);
    console.log('4. 图片生成完成，路径:', imagePath);
    
    console.log('5. 返回响应...');
    res.json({
      success: true,
      message: '新闻图片生成成功',
      data: {
        imageUrl: `/${imagePath}`,
        newsCount: newsTitles.length,
        keywords: config.keywords
      }
    });
    console.log('=== 新闻图片生成请求处理完成 ===');
  } catch (error) {
    console.error('❌ 生成新闻图片失败:', error.message);
    console.error('错误堆栈:', error.stack);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 修改管理页面HTML，添加更多排版设置
app.get('/admin', (req, res) => {
  const adminHTML = `
  <!DOCTYPE html>
  <html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>新闻图片生成 - 管理后台</title>
    <style>
      body {
        font-family: 'Microsoft YaHei', Arial, sans-serif;
        line-height: 1.6;
        color: #333;
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
      }
      h1, h2 {
        color: #2c3e50;
      }
      .card {
        background: #fff;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        padding: 20px;
        margin-bottom: 20px;
      }
      .form-group {
        margin-bottom: 15px;
      }
      label {
        display: block;
        margin-bottom: 5px;
        font-weight: bold;
      }
      input[type="text"], input[type="number"], input[type="color"], textarea, select {
        width: 100%;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        box-sizing: border-box;
      }
      button {
        background: #3498db;
        color: white;
        border: none;
        padding: 10px 15px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 16px;
        margin-right: 10px;
      }
      button:hover {
        background: #2980b9;
      }
      .tag-container {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 10px;
      }
      .tag {
        background: #e0f7fa;
        padding: 5px 10px;
        border-radius: 4px;
        display: flex;
        align-items: center;
      }
      .tag button {
        background: none;
        color: #f44336;
        border: none;
        margin-left: 5px;
        padding: 0 5px;
        cursor: pointer;
      }
      .preview {
        max-width: 100%;
        height: auto;
        margin-top: 20px;
        border: 1px solid #ddd;
      }
      .grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
      }
      .tabs {
        display: flex;
        margin-bottom: 20px;
        border-bottom: 1px solid #ddd;
      }
      .tab {
        padding: 10px 20px;
        cursor: pointer;
        border-bottom: 2px solid transparent;
      }
      .tab.active {
        border-bottom: 2px solid #3498db;
        font-weight: bold;
      }
      .tab-content {
        display: none;
      }
      .tab-content.active {
        display: block;
      }
      .success {
        color: #27ae60;
        font-weight: bold;
      }
      .error {
        color: #e74c3c;
        font-weight: bold;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>📰 新闻图片生成 - 管理后台</h1>
      <p>在这里配置API参数、关键词和图片样式</p>
    </div>
    
    <div class="tabs">
      <div class="tab active" data-tab="api">API配置</div>
      <div class="tab" data-tab="keywords">关键词设置</div>
      <div class="tab" data-tab="style">图片样式</div>
      <div class="tab" data-tab="layout">排版布局</div>
      <div class="tab" data-tab="test">测试生成</div>
    </div>
    
    <form id="configForm">
      <div id="apiTab" class="tab-content active">
        <div class="card">
          <h2>🔌 API配置</h2>
          <div class="form-group">
            <label for="apiUrl">API地址</label>
            <input type="text" id="apiUrl" name="apiUrl" placeholder="例如: https://aihubmix.com/v1/chat/completions">
          </div>
          <div class="form-group">
            <label for="apiKey">API密钥</label>
            <input type="text" id="apiKey" name="apiKey" placeholder="以sk-开头的密钥">
          </div>
          <div class="form-group">
            <label for="model">模型</label>
            <input type="text" id="model" name="model" placeholder="例如: gpt-4o-mini">
          </div>
          <div class="form-group">
            <label for="useMockData">
              <input type="checkbox" id="useMockData" name="useMockData">
              使用模拟数据（不调用API，用于测试）
            </label>
          </div>
        </div>
      </div>
      
      <div id="keywordsTab" class="tab-content">
        <div class="card">
          <h2>🔍 关键词设置</h2>
          <div class="form-group">
            <label for="newKeyword">添加关键词</label>
            <div style="display: flex;">
              <input type="text" id="newKeyword" placeholder="输入关键词">
              <button type="button" onclick="addKeyword()" style="margin-left: 10px; width: 80px;">添加</button>
            </div>
            <div id="keywordsContainer" class="tag-container">
              <!-- 关键词标签将在这里动态生成 -->
            </div>
          </div>
        </div>
      </div>
      
      <div id="styleTab" class="tab-content">
        <div class="card">
          <h2>🎨 图片样式</h2>
          <div class="grid">
            <div>
              <div class="form-group">
                <label for="width">图片宽度</label>
                <input type="number" id="width" name="width" min="300" max="1200">
              </div>
              <div class="form-group">
                <label for="height">图片高度</label>
                <input type="number" id="height" name="height" min="300" max="1600">
              </div>
              <div class="form-group">
                <label for="mainTitle">主标题</label>
                <input type="text" id="mainTitle" name="mainTitle">
              </div>
              <div class="form-group">
                <label for="backgroundColor">背景颜色</label>
                <input type="color" id="backgroundColor" name="backgroundColor">
              </div>
            </div>
            <div>
              <div class="form-group">
                <label for="titleFontSize">标题字体大小</label>
                <input type="number" id="titleFontSize" name="titleFontSize" min="12" max="72">
              </div>
              <div class="form-group">
                <label for="fontSize">正文字体大小</label>
                <input type="number" id="fontSize" name="fontSize" min="8" max="36">
              </div>
              <div class="form-group">
                <label for="titleColor">标题颜色</label>
                <input type="color" id="titleColor" name="titleColor">
              </div>
              <div class="form-group">
                <label for="textColor">正文颜色</label>
                <input type="color" id="textColor" name="textColor">
              </div>
            </div>
          </div>
          <div class="form-group">
            <label for="backgroundImage">背景图片URL</label>
            <input type="text" id="backgroundImage" name="backgroundImage" placeholder="输入背景图片的URL">
          </div>
          <div class="form-group">
            <label for="logoImage">Logo图片URL</label>
            <input type="text" id="logoImage" name="logoImage" placeholder="输入Logo图片的URL">
          </div>
        </div>
      </div>
      
      <div id="layoutTab" class="tab-content">
        <div class="card">
          <h2>📐 排版布局</h2>
          <div class="grid">
            <div>
              <div class="form-group">
                <label for="titleY">主标题Y坐标</label>
                <input type="number" id="titleY" name="titleY" min="20" max="200">
              </div>
              <div class="form-group">
                <label for="dateY">日期Y坐标</label>
                <input type="number" id="dateY" name="dateY" min="40" max="300">
              </div>
              <div class="form-group">
                <label for="keywordsY">关键词Y坐标</label>
                <input type="number" id="keywordsY" name="keywordsY" min="60" max="400">
              </div>
            </div>
            <div>
              <div class="form-group">
                <label for="textStartY">正文起始Y坐标</label>
                <input type="number" id="textStartY" name="textStartY" min="100" max="500">
              </div>
              <div class="form-group">
                <label for="lineHeight">行高</label>
                <input type="number" id="lineHeight" name="lineHeight" min="20" max="100">
              </div>
              <div class="form-group">
                <label for="textLeftPadding">左侧内边距</label>
                <input type="number" id="textLeftPadding" name="textLeftPadding" min="10" max="200">
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div id="testTab" class="tab-content">
        <div class="card">
          <h2>🧪 测试生成</h2>
          <p>点击下方按钮测试生成新闻图片</p>
          <button type="button" id="testButton" onclick="testGenerate()">🔄 测试生成</button>
          <div id="testResult"></div>
          <div id="imagePreview"></div>
        </div>
      </div>
      
      <div class="card">
        <button type="button" onclick="saveConfig()">💾 保存配置</button>
        <span id="saveResult"></span>
      </div>
    </form>
    
    <script>
      // 当前配置
      let currentConfig = ${JSON.stringify(config, null, 2)};
      
      // 页面加载时填充表单
      window.onload = function() {
        // API配置
        document.getElementById('apiUrl').value = currentConfig.openai.apiUrl || '';
        document.getElementById('apiKey').value = currentConfig.openai.apiKey || '';
        document.getElementById('model').value = currentConfig.openai.model || '';
        document.getElementById('useMockData').checked = currentConfig.useMockData || false;
        
        // 关键词
        renderKeywords();
        
        // 图片样式
        const style = currentConfig.imageStyle || {};
        document.getElementById('width').value = style.width || 600;
        document.getElementById('height').value = style.height || 800;
        document.getElementById('titleFontSize').value = style.titleFontSize || 28;
        document.getElementById('fontSize').value = style.fontSize || 16;
        document.getElementById('titleColor').value = style.titleColor || '#333333';
        document.getElementById('textColor').value = style.textColor || '#666666';
        document.getElementById('backgroundColor').value = style.backgroundColor || '#ffffff';
        document.getElementById('mainTitle').value = style.mainTitle || '今日摸鱼见闻';
        document.getElementById('backgroundImage').value = style.backgroundImage || '';
        document.getElementById('logoImage').value = style.logoImage || '';
        
        // 排版布局
        document.getElementById('titleY').value = style.titleY || 50;
        document.getElementById('dateY').value = style.dateY || 80;
        document.getElementById('keywordsY').value = style.keywordsY || 110;
        document.getElementById('textStartY').value = style.textStartY || 190;
        document.getElementById('lineHeight').value = style.lineHeight || 40;
        document.getElementById('textLeftPadding').value = style.textLeftPadding || 60;
      };
      
      // 渲染关键词标签
      function renderKeywords() {
        const container = document.getElementById('keywordsContainer');
        container.innerHTML = '';
        
        currentConfig.keywords.forEach((keyword, index) => {
          const tag = document.createElement('div');
          tag.className = 'tag';
          tag.innerHTML = keyword + '<button type="button" onclick="removeKeyword(' + index + ')">×</button>';
          container.appendChild(tag);
        });
      }
      
      // 添加关键词
      function addKeyword() {
        const input = document.getElementById('newKeyword');
        const keyword = input.value.trim();
        
        if (keyword && !currentConfig.keywords.includes(keyword)) {
          currentConfig.keywords.push(keyword);
          renderKeywords();
          input.value = '';
        }
      }
      
      // 删除关键词
      function removeKeyword(index) {
        currentConfig.keywords.splice(index, 1);
        renderKeywords();
      }
      
      // 保存配置
      function saveConfig() {
        // 收集API配置
        currentConfig.openai.apiUrl = document.getElementById('apiUrl').value;
        currentConfig.openai.apiKey = document.getElementById('apiKey').value;
        currentConfig.openai.model = document.getElementById('model').value;
        currentConfig.useMockData = document.getElementById('useMockData').checked;
        
        // 收集图片样式
        currentConfig.imageStyle = {
          width: parseInt(document.getElementById('width').value),
          height: parseInt(document.getElementById('height').value),
          titleFontSize: parseInt(document.getElementById('titleFontSize').value),
          fontSize: parseInt(document.getElementById('fontSize').value),
          titleColor: document.getElementById('titleColor').value,
          textColor: document.getElementById('textColor').value,
          backgroundColor: document.getElementById('backgroundColor').value,
          mainTitle: document.getElementById('mainTitle').value,
          backgroundImage: document.getElementById('backgroundImage').value,
          logoImage: document.getElementById('logoImage').value,
          
          // 排版布局
          titleY: parseInt(document.getElementById('titleY').value),
          dateY: parseInt(document.getElementById('dateY').value),
          keywordsY: parseInt(document.getElementById('keywordsY').value),
          textStartY: parseInt(document.getElementById('textStartY').value),
          lineHeight: parseInt(document.getElementById('lineHeight').value),
          textLeftPadding: parseInt(document.getElementById('textLeftPadding').value)
        };
        
        // 发送到服务器
        fetch('/api/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(currentConfig)
        })
        .then(response => response.json())
        .then(data => {
          document.getElementById('saveResult').innerHTML = '<span class="success">✅ 配置已保存</span>';
          setTimeout(() => {
            document.getElementById('saveResult').innerHTML = '';
          }, 3000);
        })
        .catch(error => {
          document.getElementById('saveResult').innerHTML = '<span class="error">❌ 保存失败: ' + error.message + '</span>';
        });
      }
      
      // 测试生成
      function testGenerate() {
        document.getElementById('testButton').disabled = true;
        document.getElementById('testButton').textContent = '⏳ 生成中...';
        document.getElementById('testResult').innerHTML = '<p>正在生成图片，请稍候...</p>';
        
        fetch('/api/news-image')
        .then(response => response.json())
        .then(data => {
          document.getElementById('testButton').disabled = false;
          document.getElementById('testButton').textContent = '🔄 测试生成';
          
          if (data.success) {
            document.getElementById('testResult').innerHTML = '<p class="success">✅ 图片生成成功</p>';
            document.getElementById('imagePreview').innerHTML = '<img src="/news-latest.png?' + new Date().getTime() + '" class="preview" alt="生成的新闻图片">';
          } else {
            document.getElementById('testResult').innerHTML = '<p class="error">❌ 生成失败: ' + data.message + '</p>';
          }
        })
        .catch(error => {
          document.getElementById('testButton').disabled = false;
          document.getElementById('testButton').textContent = '🔄 测试生成';
          document.getElementById('testResult').innerHTML = '<p class="error">❌ 请求失败: ' + error.message + '</p>';
        });
      }
      
      // 标签页切换
      document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
          // 移除所有active类
          document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
          document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
          
          // 添加active类到当前标签
          tab.classList.add('active');
          document.getElementById(tab.dataset.tab + 'Tab').classList.add('active');
        });
      });
    </script>
  </body>
  </html>
  `;
  
  res.send(adminHTML);
});

// API路由：获取配置
app.get('/api/config', (req, res) => {
  res.json({
    success: true,
    data: config
  });
});

// API路由：保存配置
app.post('/api/config', (req, res) => {
  try {
    const newConfig = req.body;
    
    // 验证配置
    if (!newConfig.openai || !newConfig.openai.apiUrl || !newConfig.openai.apiKey) {
      return res.status(400).json({
        success: false,
        message: '请填写完整的OpenAI API配置'
      });
    }
    
    if (!newConfig.keywords || newConfig.keywords.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请至少添加一个关键词'
      });
    }
    
    // 保存配置
    config = newConfig;
    if (saveConfig(config)) {
      res.json({
        success: true,
        message: '配置保存成功'
      });
    } else {
      res.status(500).json({
        success: false,
        message: '配置保存失败'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 模型身份回答
app.post('/api/chat', (req, res) => {
  const { message } = req.body;
  
  // 检查是否是询问模型身份的问题
  const identityQuestions = [
    '是什么模型', '是谁的问题', '你是什么', '你是谁', '什么模型', '模型名称'
  ];
  
  const isIdentityQuestion = identityQuestions.some(question => 
    message.toLowerCase().includes(question.toLowerCase())
  );
  
  if (isIdentityQuestion) {
    res.json({
      success: true,
      message: '我是由default模型支持的智能助手，专为Cursor IDE设计，可以帮您解决各类编程难题，请告诉我你需要什么帮助？'
    });
  } else {
    res.json({
      success: true,
      message: '我是新闻图片生成助手，可以帮您生成新闻图片。请访问 /admin 进行配置，或访问 /api/news-image 生成图片。'
    });
  }
});

// 首页
app.get('/', (req, res) => {
  res.send(`
    <h1>新闻图片生成系统</h1>
    <p><a href="/admin">后台配置</a></p>
    <p><a href="/api/news-image">生成新闻图片</a></p>
  `);
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 服务器启动成功！`);
  console.log(`📱 后台配置页面: http://localhost:${PORT}/admin`);
  console.log(`🖼️  新闻图片API: http://localhost:${PORT}/api/news-image`);
  console.log(`🏠 首页: http://localhost:${PORT}`);
}); 