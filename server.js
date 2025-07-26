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
  // 添加自定义搜索提示词
  customSearchPrompt: '',
  // 添加落款文本
  footerText: '',
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
    
    // 自定义内容设置
    customContentY: 600, // 自定义内容Y坐标
    footerY: 750, // 落款Y坐标
    
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
    
    // 构建提示词
    let prompt = `请搜索今天与以下关键词相关的新闻，返回5-10条新闻标题，格式为JSON数组：
关键词：${keywords.join('、')}

要求：
1. 只返回新闻标题
2. 每条标题不超过25字
3. 返回格式：[{"title": "新闻标题1"}, {"title": "新闻标题2"}]`;

    // 如果有自定义搜索提示词，添加到请求中
    if (config.customSearchPrompt && config.customSearchPrompt.trim()) {
      prompt += `\n\n额外要求：${config.customSearchPrompt}，请用<custom_content>标签包裹，内容不超过25字`;
      console.log('   - 使用自定义搜索提示词:', config.customSearchPrompt);
    }

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
        web_search_options: {} // 启用联网搜索
      };
      headers['Authorization'] = `Bearer ${config.openai.apiKey}`;
    } else if (config.openai.apiUrl.includes('poloai.top')) {
      // poloai.top format
      requestData = {
        model: config.openai.model,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
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
      // 首先尝试直接解析JSON
      const newsData = JSON.parse(content);
      return newsData.map(item => item.title);
    } catch (parseError) {
      console.log('直接JSON解析失败，尝试提取JSON格式内容...');
      
      // 尝试从文本中提取JSON格式的内容
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          const jsonContent = jsonMatch[0];
          const newsData = JSON.parse(jsonContent);
          return newsData.map(item => item.title);
        } catch (jsonError) {
          console.log('JSON数组解析失败，尝试逐行提取...');
        }
      }
      
      // 尝试从文本中提取新闻标题（处理包含格式标记的情况）
      const lines = content.split('\n').filter(line => {
        const trimmed = line.trim();
        // 过滤掉格式标记、空行、标题行等
        return trimmed.length > 5 && 
               !trimmed.startsWith('以下是与') &&
               !trimmed.startsWith('```') &&
               !trimmed.startsWith('新闻标题') &&
               !trimmed.startsWith('相关的最新') &&
               trimmed.includes('title');
      });
      
      const titles = [];
      for (const line of lines) {
        // 提取title字段的内容
        const titleMatch = line.match(/"title":\s*"([^"]+)"/);
        if (titleMatch && titleMatch[1]) {
          titles.push(titleMatch[1]);
        }
      }
      
      if (titles.length > 0) {
        return titles;
      }
      
      // 最后的备选方案：按行分割并过滤
      const fallbackLines = content.split(/[。！？\n]/).filter(line => {
        const trimmed = line.trim();
        return trimmed.length > 5 && 
               !trimmed.startsWith('以下是与') &&
               !trimmed.startsWith('```') &&
               !trimmed.startsWith('新闻标题');
      });
      return fallbackLines.slice(0, 10);
    }
  } catch (error) {
    console.error('调用AI API失败:', error.message);
    console.error('错误详情:', error.response?.data || error);
    throw new Error('获取新闻失败');
  }
}

// 生成图片（使用Canvas生成PNG）
async function generateImage(newsTitles, keywords) {
  const today = new Date().toLocaleDateString('zh-CN');
  
  // 检查是否有canvas模块
  let Canvas;
  try {
    Canvas = require('canvas');
    console.log('✅ Canvas模块加载成功，将生成PNG图片');
    console.log('Canvas版本:', Canvas.version);
  } catch (error) {
    console.log('❌ Canvas模块未安装，使用HTML生成');
    console.log('错误详情:', error.message);
    return generateHTMLImage(newsTitles, keywords);
  }
  
  console.log('创建Canvas，尺寸:', config.imageStyle.width, 'x', config.imageStyle.height);
  const canvas = Canvas.createCanvas(config.imageStyle.width, config.imageStyle.height);
  const ctx = canvas.getContext('2d');
  
  console.log('设置背景色:', config.imageStyle.backgroundColor);
  // 设置背景
  ctx.fillStyle = config.imageStyle.backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // 如果有背景图片，绘制背景图片
  if (config.imageStyle.backgroundImage) {
    try {
      console.log('加载背景图片:', config.imageStyle.backgroundImage);
      const backgroundImg = await Canvas.loadImage(config.imageStyle.backgroundImage);
      ctx.drawImage(backgroundImg, 0, 0, canvas.width, canvas.height);
    } catch (error) {
      console.log('背景图片加载失败，使用纯色背景:', error.message);
    }
  }
  
  // 设置字体 - 使用中文字体
  ctx.font = `bold ${config.imageStyle.titleFontSize}px "Noto Sans CJK SC", "WenQuanYi Micro Hei", sans-serif`;
  ctx.fillStyle = config.imageStyle.titleColor;
  ctx.textAlign = 'center';
  
  // 绘制主标题
  ctx.fillText(config.imageStyle.mainTitle, canvas.width / 2, 50);
  
  // 绘制日期
  ctx.font = `${config.imageStyle.fontSize}px "Noto Sans CJK SC", "WenQuanYi Micro Hei", sans-serif`;
  ctx.fillStyle = config.imageStyle.textColor;
  ctx.fillText(today, canvas.width / 2, 80);
  
  // 绘制关键词
  ctx.font = `${config.imageStyle.fontSize + 2}px "Noto Sans CJK SC", "WenQuanYi Micro Hei", sans-serif`;
  ctx.fillStyle = config.imageStyle.titleColor;
  ctx.fillText(`关键词：${keywords.join('、')}`, canvas.width / 2, 110);
  
  // 绘制新闻列表 - 为插图预留右侧空间
  ctx.font = `${config.imageStyle.fontSize}px "Noto Sans CJK SC", "WenQuanYi Micro Hei", sans-serif`;
  ctx.fillStyle = config.imageStyle.textColor;
  ctx.textAlign = 'left';
  
  // 计算文字区域宽度，为插图预留空间
  const textAreaWidth = canvas.width - 200; // 右侧预留200px给插图
  const lineHeight = 30;
  let y = 150;
  
  newsTitles.forEach((title, index) => {
    const text = `${index + 1}. ${title}`;
    
    // 检查文字是否超出区域宽度
    const textWidth = ctx.measureText(text).width;
    if (textWidth > textAreaWidth) {
      // 如果文字太长，进行换行处理
      const words = text.split('');
      let currentLine = '';
      let lineY = y;
      
      for (let i = 0; i < words.length; i++) {
        const testLine = currentLine + words[i];
        const testWidth = ctx.measureText(testLine).width;
        
        if (testWidth > textAreaWidth && currentLine.length > 0) {
          ctx.fillText(currentLine, 30, lineY);
          currentLine = words[i];
          lineY += lineHeight;
        } else {
          currentLine = testLine;
        }
      }
      
      if (currentLine.length > 0) {
        ctx.fillText(currentLine, 30, lineY);
        lineY += lineHeight;
      }
      
      y = lineY + 10; // 额外间距
    } else {
      ctx.fillText(text, 30, y);
      y += lineHeight;
    }
  });
  
  // 绘制自定义内容（如果有）
  if (config.customSearchPrompt && config.customSearchPrompt.trim()) {
    // 这里需要从API响应中提取自定义内容，暂时留空
    // 后续会在调用时处理
  }
  
  // 绘制落款（如果有）
  if (config.footerText && config.footerText.trim()) {
    ctx.font = `${config.imageStyle.fontSize - 2}px "Noto Sans CJK SC", "WenQuanYi Micro Hei", sans-serif`;
    ctx.fillStyle = '#999999';
    ctx.textAlign = 'right';
    ctx.fillText(config.footerText, canvas.width - 20, canvas.height - 20);
  }
  console.log('开始生成PNG图片...');
  // 保存为PNG
  const buffer = canvas.toBuffer('image/png');
  console.log('PNG图片生成完成，大小:', buffer.length, '字节');
  fs.writeFileSync('public/news-latest.png', buffer);
  console.log('PNG图片已保存到 public/news-latest.png');
  
  return 'news-latest.png';
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
    const imagePath = await generateImage(newsTitles, config.keywords);
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

// 后台配置页面
app.get('/admin', (req, res) => {
  const adminHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>新闻图片生成系统 - 后台配置</title>
  <style>
    body {
      font-family: 'Microsoft YaHei', Arial, sans-serif;
      margin: 0;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      max-width: 1000px;
      margin: 0 auto;
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    h1 {
      color: #1890ff;
      text-align: center;
      margin-bottom: 30px;
    }
    .section {
      border: 1px solid #e8e8e8;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .section-title {
      font-size: 18px;
      font-weight: bold;
      color: #1890ff;
      margin-bottom: 15px;
      border-bottom: 2px solid #1890ff;
      padding-bottom: 5px;
    }
    .form-group {
      margin-bottom: 20px;
    }
    .form-row {
      display: flex;
      gap: 15px;
      margin-bottom: 15px;
    }
    .form-col {
      flex: 1;
    }
    label {
      display: block;
      margin-bottom: 5px;
      font-weight: bold;
      color: #333;
    }
    input, textarea, select {
      width: 100%;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
      box-sizing: border-box;
    }
    .color-picker {
      width: 60px !important;
      height: 40px;
      padding: 0;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    .save-btn {
      background: #52c41a;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
      margin-right: 10px;
    }
    .test-btn {
      background: #1890ff;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
    }
    .btn-group {
      text-align: center;
      margin-top: 30px;
    }
    .preview {
      margin-top: 20px;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 4px;
      border-left: 4px solid #1890ff;
    }
      font-size: 16px;
      width: 100%;
    }
    .test-btn {
      background: #faad14;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
      width: 100%;
      margin-top: 10px;
    }
    .message {
      padding: 10px;
      border-radius: 4px;
      margin-bottom: 20px;
    }
    .success {
      background: #f6ffed;
      border: 1px solid #b7eb8f;
      color: #52c41a;
    }
    .error {
      background: #fff2f0;
      border: 1px solid #ffccc7;
      color: #ff4d4f;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>新闻图片生成系统 - 后台配置</h1>
    
    <div id="message"></div>
    
    <form id="configForm">
      
      <!-- API 配置部分 -->
      <div class="section">
        <div class="section-title">🤖 AI API 配置</div>
        <div class="form-group">
          <label>OpenAI API 地址</label>
          <input type="text" id="apiUrl" placeholder="https://aihubmix.com/v1/chat/completions">
        </div>
        <div class="form-group">
          <label>API Key</label>
          <input type="password" id="apiKey" placeholder="输入您的API Key">
        </div>
        <div class="form-group">
          <label>模型名称</label>
          <input type="text" id="model" placeholder="输入模型名称，如：gpt-3.5-turbo、gpt-4、claude-3等">
        </div>
        <div class="form-group">
          <label>关键词（用逗号分隔）</label>
          <input type="text" id="keywords" placeholder="科技,社会,财经">
        </div>
        <div class="form-group">
          <label>自定义搜索提示词</label>
          <input type="text" id="customSearchPrompt" placeholder="例如：请搜索今日运势相关内容">
        </div>
        <div class="form-group">
          <label>落款文本</label>
          <input type="text" id="footerText" placeholder="例如：豆包AI生成">
        </div>
        <div class="form-group">
          <label>
            <input type="checkbox" id="useMockData" style="width: auto; margin-right: 8px;">
            使用模拟数据（API余额不足时使用）
          </label>
        </div>
      </div>

      <!-- 图片样式配置部分 -->
      <div class="section">
        <div class="section-title">🎨 图片样式配置</div>
        
        <div class="form-row">
          <div class="form-col">
            <label>图片宽度 (px)</label>
            <input type="number" id="imageWidth" placeholder="800" min="400" max="1200">
          </div>
          <div class="form-col">
            <label>图片高度 (px)</label>
            <input type="number" id="imageHeight" placeholder="600" min="400" max="1000">
          </div>
        </div>

        <div class="form-row">
          <div class="form-col">
            <label>标题字体大小 (px)</label>
            <input type="number" id="titleFontSize" placeholder="28" min="16" max="48">
          </div>
          <div class="form-col">
            <label>正文字体大小 (px)</label>
            <input type="number" id="textFontSize" placeholder="16" min="12" max="24">
          </div>
        </div>

        <div class="form-row">
          <div class="form-col">
            <label>背景颜色</label>
            <input type="color" id="backgroundColor" class="color-picker" value="#ffffff">
          </div>
          <div class="form-col">
            <label>标题颜色</label>
            <input type="color" id="titleColor" class="color-picker" value="#333333">
          </div>
          <div class="form-col">
            <label>文字颜色</label>
            <input type="color" id="textColor" class="color-picker" value="#666666">
          </div>
        </div>

        <div class="form-group">
          <label>主标题文字</label>
          <input type="text" id="mainTitle" placeholder="今日热榜新闻" value="今日热榜新闻">
        </div>

        <div class="form-group">
          <label>背景图片URL（可选）</label>
          <input type="text" id="backgroundImage" placeholder="https://example.com/background.jpg">
        </div>

        <div class="form-group">
          <label>Logo图片URL（可选）</label>
          <input type="text" id="logoImage" placeholder="https://example.com/logo.png">
        </div>
      </div>

      <!-- 按钮组 -->
      <div class="btn-group">
        <button type="submit" class="save-btn">💾 保存配置</button>
        <button type="button" class="test-btn" onclick="testGenerate()">🚀 测试生成</button>
      </div>

      <!-- 预览区域 -->
      <div class="preview" id="preview" style="display: none;">
        <h3>📋 配置预览</h3>
        <div id="previewContent"></div>
      </div>
    </form>
  </div>

  <script>
    // 加载配置
    async function loadConfig() {
      try {
        const response = await fetch('/api/config');
        const data = await response.json();
        if (data.success) {
          const config = data.data;
          
          document.getElementById('apiUrl').value = config.openai.apiUrl || '';
          document.getElementById('apiKey').value = config.openai.apiKey || '';
          document.getElementById('model').value = config.openai.model || 'gpt-3.5-turbo';
          document.getElementById('keywords').value = config.keywords.join(',') || '';
          document.getElementById('customSearchPrompt').value = config.customSearchPrompt || '';
          document.getElementById('footerText').value = config.footerText || '';
          
          // 加载图片样式配置
          document.getElementById('imageWidth').value = config.imageStyle.width || 800;
          document.getElementById('imageHeight').value = config.imageStyle.height || 600;
          document.getElementById('titleFontSize').value = config.imageStyle.titleFontSize || 28;
          document.getElementById('textFontSize').value = config.imageStyle.fontSize || 16;
          document.getElementById('backgroundColor').value = config.imageStyle.backgroundColor || '#ffffff';
          document.getElementById('titleColor').value = config.imageStyle.titleColor || '#333333';
          document.getElementById('textColor').value = config.imageStyle.textColor || '#666666';
          document.getElementById('mainTitle').value = config.imageStyle.mainTitle || '今日热榜新闻';
          document.getElementById('backgroundImage').value = config.imageStyle.backgroundImage || '';
          document.getElementById('logoImage').value = config.imageStyle.logoImage || '';
          document.getElementById('useMockData').checked = config.useMockData || false;
        }
      } catch (error) {
        showMessage('加载配置失败: ' + error.message, 'error');
      }
    }
    
    // 显示消息
    function showMessage(message, type) {
      const messageDiv = document.getElementById('message');
      messageDiv.className = \`message \${type}\`;
      messageDiv.textContent = message;
      setTimeout(() => {
        messageDiv.textContent = '';
        messageDiv.className = '';
      }, 3000);
    }
    
    // 保存配置
    document.getElementById('configForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const keywords = document.getElementById('keywords').value.split(',').map(k => k.trim()).filter(k => k);
      
      const config = {
        openai: {
          apiUrl: document.getElementById('apiUrl').value,
          apiKey: document.getElementById('apiKey').value,
          model: document.getElementById('model').value
        },
        keywords: keywords,
        customSearchPrompt: document.getElementById('customSearchPrompt').value,
        footerText: document.getElementById('footerText').value,
        useMockData: document.getElementById('useMockData').checked,
        imageStyle: {
          width: parseInt(document.getElementById('imageWidth').value) || 800,
          height: parseInt(document.getElementById('imageHeight').value) || 600,
          titleFontSize: parseInt(document.getElementById('titleFontSize').value) || 28,
          fontSize: parseInt(document.getElementById('textFontSize').value) || 16,
          titleColor: document.getElementById('titleColor').value || '#333333',
          textColor: document.getElementById('textColor').value || '#666666',
          backgroundColor: document.getElementById('backgroundColor').value || '#ffffff',
          mainTitle: document.getElementById('mainTitle').value || '今日热榜新闻',
          backgroundImage: document.getElementById('backgroundImage').value || '',
          logoImage: document.getElementById('logoImage').value || ''
        }
      };
      
      try {
        const response = await fetch('/api/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(config)
        });
        
        const data = await response.json();
        if (data.success) {
          showMessage('配置保存成功！', 'success');
        } else {
          showMessage('配置保存失败: ' + data.message, 'error');
        }
      } catch (error) {
        showMessage('配置保存失败: ' + error.message, 'error');
      }
    });
    
    // 测试生成
    async function testGenerate() {
      try {
        showMessage('正在生成新闻图片...', 'success');
        const response = await fetch('/api/news-image');
        const data = await response.json();
        
        if (data.success) {
          showMessage('新闻图片生成成功！', 'success');
          window.open(data.data.imageUrl, '_blank');
        } else {
          showMessage('生成失败: ' + data.message, 'error');
        }
      } catch (error) {
        showMessage('生成失败: ' + error.message, 'error');
      }
    }
    
    // 页面加载时加载配置
    loadConfig();
  </script>
</body>
</html>`;

  res.send(adminHtml);
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