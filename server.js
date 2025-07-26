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
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    apiKey: '',
    model: 'gpt-3.5-turbo'
  },
  keywords: ['科技', '社会', '财经'],
  imageStyle: {
    width: 800,
    fontSize: 16,
    titleColor: '#333333',
    textColor: '#666666',
    backgroundColor: '#ffffff'
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

// 调用OpenAI API获取新闻
async function getNewsFromOpenAI(keywords) {
  try {
    const prompt = `请搜索今天与以下关键词相关的新闻，返回5-10条新闻标题，格式为JSON数组：
关键词：${keywords.join('、')}

要求：
1. 只返回新闻标题
2. 每条标题不超过50字
3. 返回格式：[{"title": "新闻标题1"}, {"title": "新闻标题2"}]`;

    const response = await axios.post(config.openai.apiUrl, {
      model: config.openai.model,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${config.openai.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const content = response.data.choices[0].message.content;
    
    // 尝试解析JSON
    try {
      const newsData = JSON.parse(content);
      return newsData.map(item => item.title);
    } catch (parseError) {
      // 如果JSON解析失败，尝试提取标题
      const titles = content.match(/[""]([^""]+)[""]/g) || [];
      return titles.map(title => title.replace(/[""]/g, ''));
    }
  } catch (error) {
    console.error('调用OpenAI API失败:', error.message);
    throw new Error('获取新闻失败');
  }
}

// 生成图片（简化版本，使用HTML生成）
function generateImage(newsTitles, keywords) {
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
    console.log('收到新闻图片生成请求');
    
    // 获取新闻
    const newsTitles = await getNewsFromOpenAI(config.keywords);
    
    // 生成图片
    const imagePath = generateImage(newsTitles, config.keywords);
    
    res.json({
      success: true,
      message: '新闻图片生成成功',
      data: {
        imageUrl: `/${imagePath}`,
        newsCount: newsTitles.length,
        keywords: config.keywords
      }
    });
  } catch (error) {
    console.error('生成新闻图片失败:', error.message);
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
      max-width: 800px;
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
    .form-group {
      margin-bottom: 20px;
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
    }
    .save-btn {
      background: #52c41a;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 4px;
      cursor: pointer;
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
      <div class="form-group">
        <label>OpenAI API 地址</label>
        <input type="text" id="apiUrl" placeholder="https://api.openai.com/v1/chat/completions">
      </div>
      
      <div class="form-group">
        <label>API Key</label>
        <input type="password" id="apiKey" placeholder="请输入您的OpenAI API Key">
      </div>
      
      <div class="form-group">
        <label>模型名称</label>
        <input type="text" id="model" placeholder="输入模型名称，如：gpt-3.5-turbo、gpt-4、claude-3等">
      </div>
      
      <div class="form-group">
        <label>关键词（用逗号分隔）</label>
        <input type="text" id="keywords" placeholder="科技,社会,财经">
      </div>
      
      <button type="submit" class="save-btn">保存配置</button>
      <button type="button" class="test-btn" onclick="testGenerate()">测试生成</button>
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
        imageStyle: {
          width: 800,
          fontSize: 16,
          titleColor: '#333333',
          textColor: '#666666',
          backgroundColor: '#ffffff'
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