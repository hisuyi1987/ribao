const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 管理员密码配置
const ADMIN_PASSWORD = '123456'; // 默认密码

// 密码验证中间件
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Access"');
    return res.status(401).json({ error: '需要身份验证' });
  }
  
  const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString();
  const [username, password] = auth.split(':');
  
  if (password === ADMIN_PASSWORD) {
    next();
  } else {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Access"');
    res.status(401).json({ error: '密码错误' });
  }
}

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
    apiUrl: '', // 请填写API地址，如：https://api.openai.com/v1/chat/completions
    apiKey: '', // 请填写API密钥
    model: 'gpt-4o-mini' // 请填写模型名称，如：gpt-3.5-turbo、gpt-4、claude-3等
  },
  keywords: [], // 请填写关键词，如：['科技', 'ai', '社会', '财经']
  useMockData: false,
  // 添加自定义搜索提示词
  customSearchPrompt: '', // 可选：自定义搜索要求，如："重点关注国内新闻"
  // 添加落款文本
  footerText: '', // 可选：图片底部落款，如："每日新闻"
  // 新闻条数设置
  newsCount: 10,
  // 定时更新设置
  autoUpdate: {
    enabled: false,
    hour: 6,  // 默认早上6点更新
    lastUpdateTime: null
  },
  imageStyle: {
    width: 600,
    height: 800,
    
    // 主标题设置
    mainTitle: '今日摸鱼见闻',
    titleFontSize: 28,
    titleColor: '#333333',
    titleY: 50, // 主标题Y坐标位置
    
    // 日期设置
    dateFontSize: 16,
    dateColor: '#666666',
    dateY: 80, // 日期Y坐标位置
    
    // 关键词设置
    keywordsFontSize: 18,
    keywordsColor: '#333333',
    keywordsY: 110, // 关键词Y坐标位置
    
    // 正文设置
    fontSize: 16,
    textColor: '#666666',
    textStartY: 150, // 正文起始Y坐标
    lineHeight: 35, // 行高
    textLeftPadding: 30, // 左侧内边距
    textRightPadding: 30, // 右侧内边距
    
    // 自定义内容设置
    customContentFontSize: 16,
    customContentColor: '#ff6b35',
    customContentX: 30, // 自定义内容X坐标
    customContentY: 600, // 自定义内容Y坐标
    
    // 落款设置
    footerFontSize: 14,
    footerColor: '#999999',
    footerY: 750, // 落款Y坐标
    footerX: 300, // 落款X坐标（居中）
    footerAlign: 'center', // 落款对齐方式：left, center, right
    
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

// 定时更新功能
let updateTimer = null;

function startAutoUpdate() {
  if (updateTimer) {
    clearInterval(updateTimer);
  }
  
  // 重新加载最新配置
  const currentConfig = loadConfig();
  
  if (currentConfig.autoUpdate && currentConfig.autoUpdate.enabled) {
    console.log(`定时更新已启动，每天 ${currentConfig.autoUpdate.hour}:00 更新`);
    
    updateTimer = setInterval(async () => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      
      // 重新加载最新配置
      const latestConfig = loadConfig();
      
      // 检查是否到了更新时间
      if (currentHour === latestConfig.autoUpdate.hour && currentMinute === 0) {
        console.log('=== 开始定时更新日报内容 ===');
        console.log('当前关键词:', latestConfig.keywords);
        
        try {
          // 获取新闻
          const newsTitles = await getNewsFromOpenAI(latestConfig.keywords);
          console.log('获取到', newsTitles.length, '条新闻');
          
          // 生成图片
          const imagePath = await generateImage(newsTitles, latestConfig.keywords);
          console.log('图片生成完成:', imagePath);
          
          // 更新最后更新时间
          latestConfig.autoUpdate.lastUpdateTime = new Date().toISOString();
          saveConfig(latestConfig);
          
          console.log('=== 定时更新完成 ===');
        } catch (error) {
          console.error('定时更新失败:', error.message);
        }
      }
    }, 60000); // 每分钟检查一次
  }
}

function stopAutoUpdate() {
  if (updateTimer) {
    clearInterval(updateTimer);
    updateTimer = null;
    console.log('定时更新已停止');
  }
}

// 加载配置
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const savedConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      
      // 合并配置，确保新配置项存在
      const mergedConfig = {
        ...defaultConfig,
        ...savedConfig,
        imageStyle: {
          ...defaultConfig.imageStyle,
          ...savedConfig.imageStyle
        }
      };
      
      console.log('配置加载成功，使用合并后的配置');
      return mergedConfig;
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
  
  // 返回配置的新闻条数
  return allNews.slice(0, config.newsCount || 10);
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
    let today = new Date().toISOString().split('T')[0];
    let yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    let prompt = `请从以下可靠的新闻网站搜索${today}（今天）和${yesterday}（昨天）这两天内与以下关键词相关的最新新闻，返回${config.newsCount}条新闻标题，格式为JSON数组：

新闻来源网站：人民网、新华网、澎湃新闻、界面新闻、36氪、财新网、中国日报网
关键词：${keywords.join('、')}

要求：
1. 严格限制只返回今天和昨天（${today}和${yesterday}）的新闻
2. 每条新闻必须标注发布日期和来源网站，格式为：[日期][来源]标题
3. 绝对不要返回更早的旧新闻，也不要编造不存在的新闻
4. 每条标题不超过25字，但必须包含具体事件、数据或观点等实质内容
5. 确保内容多样性，每个关键词至少有2-3条不同主题的新闻
6. 避免重复内容，即使表述不同也不要包含相同事件的新闻
7. 标题应该是完整的新闻标题，不要只是话题或概念
8. 如果某个关键词在最近两天内没有相关新闻，可以跳过该关键词
9. 返回格式：[{"title": "[${today}][人民网]新闻标题1"}, {"title": "[${yesterday}][新华网]新闻标题2"}]`;

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
    
    // 基础请求数据，适用于所有API提供商
    const baseRequestData = {
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
    
    if (config.openai.apiUrl.includes('aihubmix.com')) {
      // aihubmix.com format
      requestData = {
        ...baseRequestData,
        web_search_options: {
          enable: true, // 明确启用联网搜索
          search_recent_days: 2 // 搜索最近2天的内容
        }
      };
    } else if (config.openai.apiUrl.includes('poloai.top')) {
      // poloai.top format - 只支持function类型的工具
      requestData = {
        ...baseRequestData,
        // 移除不支持的tools配置
        // 对于deepseek-r1-search模型，不需要额外配置，它会自动联网搜索
      };
    } else if (config.openai.apiUrl.includes('api.openai.com')) {
      // 标准OpenAI API
      requestData = {
        ...baseRequestData,
        stream: false,
        tools: [{"type": "retrieval"}], // 启用知识检索
        tool_choice: "auto"
      };
    } else if (config.openai.apiUrl.includes('dashscope') || config.openai.apiUrl.includes('qianwen')) {
      // 通义千问API
      requestData = {
        ...baseRequestData,
        parameters: {
          enable_search: true
        }
      };
    } else if (config.openai.apiUrl.includes('claude') || config.openai.apiUrl.includes('anthropic')) {
      // Claude/Anthropic API
      requestData = {
        ...baseRequestData,
        system: "Please use your web search capability to find the most recent news.",
        tools: [{"type": "web_search"}]
      };
    } else if (config.openai.apiUrl.includes('gemini') || config.openai.apiUrl.includes('google')) {
      // Google Gemini API
      requestData = {
        ...baseRequestData,
        tools: [{"type": "web_search"}],
        tool_config: {
          web_search: {
            recency_days: 2
          }
        }
      };
    } else {
      // 通用格式，尝试添加多种联网搜索参数
      requestData = {
        ...baseRequestData,
        stream: false,
        // 尝试各种可能的联网搜索参数
        web_search: true,
        tools: [
          {"type": "web_search"},
          {"type": "retrieval"}
        ],
        tool_choice: "auto",
        web_search_options: {
          enable: true,
          search_recent_days: 2
        },
        parameters: {
          enable_search: true
        }
      };
    }
    
    // 添加授权头
    headers['Authorization'] = `Bearer ${config.openai.apiKey}`;
    
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
      
      // 提取自定义内容（如果有）
      const customContentMatch = content.match(/<custom_content>([^<]+)<\/custom_content>/);
      if (customContentMatch && customContentMatch[1]) {
        console.log('✅ 提取到自定义内容:', customContentMatch[1].trim());
        // 将自定义内容存储到全局变量中，供图片生成时使用
        global.customContent = customContentMatch[1].trim();
      } else {
        console.log('❌ 未找到自定义内容标签');
        global.customContent = null;
      }
      
      return newsData.map(item => item.title);
    } catch (parseError) {
      console.log('直接JSON解析失败，尝试提取JSON格式内容...');
      
      // 尝试从文本中提取JSON格式的内容
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          const jsonContent = jsonMatch[0];
          const newsData = JSON.parse(jsonContent);
          
          // 提取自定义内容（如果有）
          const customContentMatch = content.match(/<custom_content>([^<]+)<\/custom_content>/);
          if (customContentMatch && customContentMatch[1]) {
            console.log('✅ 提取到自定义内容:', customContentMatch[1].trim());
            // 将自定义内容存储到全局变量中，供图片生成时使用
            global.customContent = customContentMatch[1].trim();
          } else {
            console.log('❌ 未找到自定义内容标签');
            global.customContent = null;
          }
          
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
        // 提取自定义内容（如果有）
        const customContentMatch = content.match(/<custom_content>([^<]+)<\/custom_content>/);
        if (customContentMatch && customContentMatch[1]) {
          console.log('✅ 提取到自定义内容:', customContentMatch[1].trim());
          // 将自定义内容存储到全局变量中，供图片生成时使用
          global.customContent = customContentMatch[1].trim();
        } else {
          console.log('❌ 未找到自定义内容标签');
          global.customContent = null;
        }
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
      
      // 提取自定义内容（如果有）
      const customContentMatch = content.match(/<custom_content>([^<]+)<\/custom_content>/);
      if (customContentMatch && customContentMatch[1]) {
        console.log('✅ 提取到自定义内容:', customContentMatch[1].trim());
        // 将自定义内容存储到全局变量中，供图片生成时使用
        global.customContent = customContentMatch[1].trim();
      } else {
        console.log('❌ 未找到自定义内容标签');
        global.customContent = null;
      }
      
      return fallbackLines.slice(0, config.newsCount || 10);
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
  
  console.log('生成图片配置:', JSON.stringify(config.imageStyle, null, 2));
  
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
  ctx.fillText(config.imageStyle.mainTitle, canvas.width / 2, config.imageStyle.titleY);
  
  // 绘制日期
  ctx.font = `${config.imageStyle.dateFontSize}px "Noto Sans CJK SC", "WenQuanYi Micro Hei", sans-serif`;
  ctx.fillStyle = config.imageStyle.dateColor;
  ctx.fillText(today, canvas.width / 2, config.imageStyle.dateY);
  
  // 绘制关键词
  ctx.font = `${config.imageStyle.keywordsFontSize}px "Noto Sans CJK SC", "WenQuanYi Micro Hei", sans-serif`;
  ctx.fillStyle = config.imageStyle.keywordsColor;
  ctx.fillText(`关键词：${keywords.join('、')}`, canvas.width / 2, config.imageStyle.keywordsY);
  
  // 绘制新闻列表 - 为插图预留右侧空间
  ctx.font = `${config.imageStyle.fontSize}px "Noto Sans CJK SC", "WenQuanYi Micro Hei", sans-serif`;
  ctx.fillStyle = config.imageStyle.textColor;
  ctx.textAlign = 'left';
  
  // 计算文字区域宽度，使用左右内边距
  const textAreaWidth = canvas.width - config.imageStyle.textLeftPadding - config.imageStyle.textRightPadding;
  const lineHeight = config.imageStyle.lineHeight;
  let y = config.imageStyle.textStartY;
  
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
          ctx.fillText(currentLine, config.imageStyle.textLeftPadding, lineY);
          currentLine = words[i];
          lineY += lineHeight;
        } else {
          currentLine = testLine;
        }
      }
      
      if (currentLine.length > 0) {
        ctx.fillText(currentLine, config.imageStyle.textLeftPadding, lineY);
        lineY += lineHeight;
      }
      
      y = lineY + 10; // 额外间距
    } else {
      ctx.fillText(text, config.imageStyle.textLeftPadding, y);
      y += lineHeight;
    }
  });
  
  // 绘制自定义内容（如果有）
  console.log('检查自定义内容:', global.customContent);
  if (global.customContent) {
    console.log('✅ 开始绘制自定义内容:', global.customContent);
    ctx.font = `${config.imageStyle.customContentFontSize}px "Noto Sans CJK SC", "WenQuanYi Micro Hei", sans-serif`;
    ctx.fillStyle = config.imageStyle.customContentColor;
    ctx.textAlign = 'left';
    ctx.fillText(global.customContent, config.imageStyle.customContentX, config.imageStyle.customContentY);
    // 重置字体和颜色
    ctx.font = `${config.imageStyle.fontSize}px "Noto Sans CJK SC", "WenQuanYi Micro Hei", sans-serif`;
    ctx.fillStyle = config.imageStyle.textColor;
    console.log('✅ 自定义内容绘制完成');
  } else {
    console.log('❌ 没有自定义内容需要绘制');
  }
  
  // 绘制自定义内容（如果有）
  if (config.customSearchPrompt && config.customSearchPrompt.trim()) {
    // 这里需要从API响应中提取自定义内容，暂时留空
    // 后续会在调用时处理
  }
  
  // 绘制落款（如果有）
  console.log('检查落款文本:', config.footerText);
  if (config.footerText && config.footerText.trim()) {
    console.log('✅ 开始绘制落款:', config.footerText);
    ctx.font = `${config.imageStyle.footerFontSize}px "Noto Sans CJK SC", "WenQuanYi Micro Hei", sans-serif`;
    ctx.fillStyle = config.imageStyle.footerColor;
    
    // 根据对齐方式设置文本对齐
    if (config.imageStyle.footerAlign === 'center') {
      ctx.textAlign = 'center';
      ctx.fillText(config.footerText, config.imageStyle.footerX, config.imageStyle.footerY);
    } else if (config.imageStyle.footerAlign === 'right') {
      ctx.textAlign = 'right';
      ctx.fillText(config.footerText, config.imageStyle.footerX, config.imageStyle.footerY);
    } else {
      ctx.textAlign = 'left';
      ctx.fillText(config.footerText, config.imageStyle.footerX, config.imageStyle.footerY);
    }
    
    console.log('✅ 落款绘制完成');
  } else {
    console.log('❌ 没有落款文本需要绘制');
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
    
    // 重新加载最新配置
    const latestConfig = loadConfig();
    console.log('当前关键词:', latestConfig.keywords);
    console.log('当前配置:', JSON.stringify(latestConfig, null, 2));
    
    // 验证关键词
    if (!latestConfig.keywords || latestConfig.keywords.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请先在配置页面设置关键词'
      });
    }
    
    // 获取新闻
    console.log('1. 开始调用AI API获取新闻...');
    const newsTitles = await getNewsFromOpenAI(latestConfig.keywords);
    console.log('2. AI API调用完成，获取到', newsTitles.length, '条新闻');
    console.log('新闻标题:', newsTitles);
    
    // 生成图片
    console.log('3. 开始生成图片...');
    const imagePath = await generateImage(newsTitles, latestConfig.keywords);
    console.log('4. 图片生成完成，路径:', imagePath);
    
    console.log('5. 返回响应...');
    res.json({
      success: true,
      message: '新闻图片生成成功',
      data: {
        imageUrl: `/${imagePath}`,
        newsCount: newsTitles.length,
        keywords: latestConfig.keywords
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
app.get('/admin', requireAuth, (req, res) => {
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
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;
    }
    .save-btn:hover {
      background: #389e0d;
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(82, 196, 26, 0.3);
    }
    .save-btn:active {
      transform: translateY(0);
      box-shadow: 0 2px 4px rgba(82, 196, 26, 0.3);
    }


    .test-btn {
      background: #1890ff;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;
    }
    .test-btn:hover {
      background: #096dd9;
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(24, 144, 255, 0.3);
    }
    .test-btn:active {
      transform: translateY(0);
      box-shadow: 0 2px 4px rgba(24, 144, 255, 0.3);
    }

    /* 立即更新按钮特殊样式 */
    .test-btn[onclick="manualUpdate()"] {
      background: #fa8c16 !important;
    }
    .test-btn[onclick="manualUpdate()"]:hover {
      background: #d46b08 !important;
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

  </style>
</head>
<body>
  <div class="container">
    <h1>新闻图片生成系统 - 后台配置</h1>
    

    
    <form id="configForm">
      
      <!-- API 配置部分 -->
      <div class="section">
        <div class="section-title">🤖 AI API 配置</div>
        <div class="form-group">
          <label>OpenAI API 地址</label>
          <input type="text" id="apiUrl" placeholder="请输入API地址，如：https://api.openai.com/v1/chat/completions">
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
          <input type="text" id="keywords" placeholder="请输入关键词，如：科技,社会,财经,ai,人工智能">
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
          <label>新闻条数 (5-10条)</label>
          <input type="number" id="newsCount" placeholder="10" min="5" max="10" value="10">
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
        
        <!-- 基础尺寸设置 -->
        <div class="form-row">
          <div class="form-col">
            <label>图片宽度 (px)</label>
            <input type="number" id="imageWidth" placeholder="600" min="400" max="1200">
          </div>
          <div class="form-col">
            <label>图片高度 (px)</label>
            <input type="number" id="imageHeight" placeholder="800" min="400" max="1200">
          </div>
        </div>

        <!-- 主标题设置 -->
        <div class="form-row">
          <div class="form-col">
            <label>主标题文字</label>
            <input type="text" id="mainTitle" placeholder="今日摸鱼见闻" value="今日摸鱼见闻">
          </div>
          <div class="form-col">
            <label>主标题字体大小 (px)</label>
            <input type="number" id="titleFontSize" placeholder="28" min="16" max="48">
          </div>
          <div class="form-col">
            <label>主标题颜色</label>
            <input type="color" id="titleColor" class="color-picker" value="#333333">
          </div>
        </div>

        <div class="form-row">
          <div class="form-col">
            <label>主标题Y坐标</label>
            <input type="number" id="titleY" placeholder="50" min="20" max="200">
          </div>
        </div>

        <!-- 日期设置 -->
        <div class="form-row">
          <div class="form-col">
            <label>日期字体大小 (px)</label>
            <input type="number" id="dateFontSize" placeholder="16" min="12" max="24">
          </div>
          <div class="form-col">
            <label>日期颜色</label>
            <input type="color" id="dateColor" class="color-picker" value="#666666">
          </div>
          <div class="form-col">
            <label>日期Y坐标</label>
            <input type="number" id="dateY" placeholder="80" min="40" max="200">
          </div>
        </div>

        <!-- 关键词设置 -->
        <div class="form-row">
          <div class="form-col">
            <label>关键词字体大小 (px)</label>
            <input type="number" id="keywordsFontSize" placeholder="18" min="12" max="24">
          </div>
          <div class="form-col">
            <label>关键词颜色</label>
            <input type="color" id="keywordsColor" class="color-picker" value="#333333">
          </div>
          <div class="form-col">
            <label>关键词Y坐标</label>
            <input type="number" id="keywordsY" placeholder="110" min="60" max="250">
          </div>
        </div>

        <!-- 正文设置 -->
        <div class="form-row">
          <div class="form-col">
            <label>正文字体大小 (px)</label>
            <input type="number" id="textFontSize" placeholder="16" min="12" max="24">
          </div>
          <div class="form-col">
            <label>正文颜色</label>
            <input type="color" id="textColor" class="color-picker" value="#666666">
          </div>
          <div class="form-col">
            <label>行高 (px)</label>
            <input type="number" id="lineHeight" placeholder="35" min="20" max="60">
          </div>
        </div>

        <div class="form-row">
          <div class="form-col">
            <label>正文起始Y坐标</label>
            <input type="number" id="textStartY" placeholder="150" min="100" max="300">
          </div>
          <div class="form-col">
            <label>左侧内边距 (px)</label>
            <input type="number" id="textLeftPadding" placeholder="30" min="10" max="100">
          </div>
          <div class="form-col">
            <label>右侧内边距 (px)</label>
            <input type="number" id="textRightPadding" placeholder="30" min="10" max="100">
          </div>
        </div>

        <!-- 自定义内容设置 -->
        <div class="form-row">
          <div class="form-col">
            <label>自定义内容字体大小 (px)</label>
            <input type="number" id="customContentFontSize" placeholder="16" min="12" max="24">
          </div>
          <div class="form-col">
            <label>自定义内容颜色</label>
            <input type="color" id="customContentColor" class="color-picker" value="#ff6b35">
          </div>
        </div>

        <div class="form-row">
          <div class="form-col">
            <label>自定义内容X坐标</label>
            <input type="number" id="customContentX" placeholder="30" min="10" max="600">
          </div>
          <div class="form-col">
            <label>自定义内容Y坐标</label>
            <input type="number" id="customContentY" placeholder="600" min="100" max="800">
          </div>
        </div>

        <!-- 落款设置 -->
        <div class="form-row">
          <div class="form-col">
            <label>落款字体大小 (px)</label>
            <input type="number" id="footerFontSize" placeholder="14" min="10" max="20">
          </div>
          <div class="form-col">
            <label>落款颜色</label>
            <input type="color" id="footerColor" class="color-picker" value="#999999">
          </div>
          <div class="form-col">
            <label>落款对齐方式</label>
            <select id="footerAlign">
              <option value="left">左对齐</option>
              <option value="center" selected>居中</option>
              <option value="right">右对齐</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-col">
            <label>落款X坐标</label>
            <input type="number" id="footerX" placeholder="300" min="10" max="600">
          </div>
          <div class="form-col">
            <label>落款Y坐标</label>
            <input type="number" id="footerY" placeholder="750" min="100" max="800">
          </div>
        </div>

        <!-- 背景设置 -->
        <div class="form-row">
          <div class="form-col">
            <label>背景颜色</label>
            <input type="color" id="backgroundColor" class="color-picker" value="#ffffff">
          </div>
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

      <!-- 定时更新设置 -->
      <div class="section">
        <div class="section-title">⏰ 定时更新设置</div>
        <div class="form-row">
          <div class="form-col">
            <label>启用定时更新</label>
            <input type="checkbox" id="autoUpdateEnabled" style="width: auto;">
          </div>
          <div class="form-col">
            <label>更新时间（小时）</label>
            <input type="number" id="autoUpdateHour" placeholder="6" min="0" max="23" value="6">
          </div>
        </div>
        <div class="form-group">
          <label>最后更新时间</label>
          <input type="text" id="lastUpdateTime" readonly style="background-color: #f5f5f5;">
        </div>
        <div class="form-group">
          <button type="button" class="test-btn" onclick="manualUpdate()" style="background: #fa8c16;">🔄 立即更新</button>
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
          document.getElementById('keywords').value = config.keywords && config.keywords.length > 0 ? config.keywords.join(',') : '';
          document.getElementById('customSearchPrompt').value = config.customSearchPrompt || '';
          document.getElementById('footerText').value = config.footerText || '';
          document.getElementById('newsCount').value = config.newsCount || 10;
          
          // 加载图片样式配置
          document.getElementById('imageWidth').value = config.imageStyle.width || 600;
          document.getElementById('imageHeight').value = config.imageStyle.height || 800;
          document.getElementById('mainTitle').value = config.imageStyle.mainTitle || '今日摸鱼见闻';
          document.getElementById('titleFontSize').value = config.imageStyle.titleFontSize || 28;
          document.getElementById('titleColor').value = config.imageStyle.titleColor || '#333333';
          document.getElementById('titleY').value = config.imageStyle.titleY || 50;
          
          document.getElementById('dateFontSize').value = config.imageStyle.dateFontSize || 16;
          document.getElementById('dateColor').value = config.imageStyle.dateColor || '#666666';
          document.getElementById('dateY').value = config.imageStyle.dateY || 80;
          
          document.getElementById('keywordsFontSize').value = config.imageStyle.keywordsFontSize || 18;
          document.getElementById('keywordsColor').value = config.imageStyle.keywordsColor || '#333333';
          document.getElementById('keywordsY').value = config.imageStyle.keywordsY || 110;
          
          document.getElementById('textFontSize').value = config.imageStyle.fontSize || 16;
          document.getElementById('textColor').value = config.imageStyle.textColor || '#666666';
          document.getElementById('lineHeight').value = config.imageStyle.lineHeight || 35;
          document.getElementById('textStartY').value = config.imageStyle.textStartY || 150;
          document.getElementById('textLeftPadding').value = config.imageStyle.textLeftPadding || 30;
          document.getElementById('textRightPadding').value = config.imageStyle.textRightPadding || 30;
          
          document.getElementById('customContentFontSize').value = config.imageStyle.customContentFontSize || 16;
          document.getElementById('customContentColor').value = config.imageStyle.customContentColor || '#ff6b35';
          document.getElementById('customContentX').value = config.imageStyle.customContentX || 30;
          document.getElementById('customContentY').value = config.imageStyle.customContentY || 600;
          
          document.getElementById('footerFontSize').value = config.imageStyle.footerFontSize || 14;
          document.getElementById('footerColor').value = config.imageStyle.footerColor || '#999999';
          document.getElementById('footerX').value = config.imageStyle.footerX || 300;
          document.getElementById('footerY').value = config.imageStyle.footerY || 750;
          document.getElementById('footerAlign').value = config.imageStyle.footerAlign || 'center';
          
          document.getElementById('backgroundColor').value = config.imageStyle.backgroundColor || '#ffffff';
          document.getElementById('backgroundImage').value = config.imageStyle.backgroundImage || '';
          document.getElementById('logoImage').value = config.imageStyle.logoImage || '';
          document.getElementById('useMockData').checked = config.useMockData || false;
          
          // 加载定时更新配置
          document.getElementById('autoUpdateEnabled').checked = config.autoUpdate?.enabled || false;
          document.getElementById('autoUpdateHour').value = config.autoUpdate?.hour || 6;
          
          // 显示最后更新时间
          if (config.autoUpdate?.lastUpdateTime) {
            const lastUpdate = new Date(config.autoUpdate.lastUpdateTime);
            document.getElementById('lastUpdateTime').value = lastUpdate.toLocaleString('zh-CN');
          } else {
            document.getElementById('lastUpdateTime').value = '从未更新';
          }
        }
      } catch (error) {
        console.error('加载配置失败: ' + error.message);
      }
    }
    

    
    // 保存配置
    document.getElementById('configForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const saveBtn = document.querySelector('.save-btn');
      const originalText = saveBtn.textContent;
      
      // 设置加载状态
      saveBtn.textContent = '💾 保存中...';
      saveBtn.disabled = true;
      
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
        newsCount: parseInt(document.getElementById('newsCount').value) || 10,
        useMockData: document.getElementById('useMockData').checked,
        autoUpdate: {
          enabled: document.getElementById('autoUpdateEnabled').checked,
          hour: parseInt(document.getElementById('autoUpdateHour').value) || 6,
          lastUpdateTime: null
        },
        imageStyle: {
          width: parseInt(document.getElementById('imageWidth').value) || 600,
          height: parseInt(document.getElementById('imageHeight').value) || 800,
          
          mainTitle: document.getElementById('mainTitle').value || '今日摸鱼见闻',
          titleFontSize: parseInt(document.getElementById('titleFontSize').value) || 28,
          titleColor: document.getElementById('titleColor').value || '#333333',
          titleY: parseInt(document.getElementById('titleY').value) || 50,
          
          dateFontSize: parseInt(document.getElementById('dateFontSize').value) || 16,
          dateColor: document.getElementById('dateColor').value || '#666666',
          dateY: parseInt(document.getElementById('dateY').value) || 80,
          
          keywordsFontSize: parseInt(document.getElementById('keywordsFontSize').value) || 18,
          keywordsColor: document.getElementById('keywordsColor').value || '#333333',
          keywordsY: parseInt(document.getElementById('keywordsY').value) || 110,
          
          fontSize: parseInt(document.getElementById('textFontSize').value) || 16,
          textColor: document.getElementById('textColor').value || '#666666',
          lineHeight: parseInt(document.getElementById('lineHeight').value) || 35,
          textStartY: parseInt(document.getElementById('textStartY').value) || 150,
          textLeftPadding: parseInt(document.getElementById('textLeftPadding').value) || 30,
          textRightPadding: parseInt(document.getElementById('textRightPadding').value) || 30,
          
          customContentFontSize: parseInt(document.getElementById('customContentFontSize').value) || 16,
          customContentColor: document.getElementById('customContentColor').value || '#ff6b35',
          customContentX: parseInt(document.getElementById('customContentX').value) || 30,
          customContentY: parseInt(document.getElementById('customContentY').value) || 600,
          
          footerFontSize: parseInt(document.getElementById('footerFontSize').value) || 14,
          footerColor: document.getElementById('footerColor').value || '#999999',
          footerX: parseInt(document.getElementById('footerX').value) || 300,
          footerY: parseInt(document.getElementById('footerY').value) || 750,
          footerAlign: document.getElementById('footerAlign').value || 'center',
          
          backgroundColor: document.getElementById('backgroundColor').value || '#ffffff',
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
          // 添加成功动画
          saveBtn.style.background = '#52c41a';
          setTimeout(() => {
            saveBtn.style.background = '';
          }, 1000);
        } else {
          console.error('配置保存失败: ' + data.message);
        }
      } catch (error) {
        console.error('配置保存失败: ' + error.message);
      } finally {
        // 恢复按钮状态
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
      }
    });
    
    // 测试生成
    async function testGenerate() {
      const testBtn = document.querySelector('.test-btn');
      const originalText = testBtn.textContent;
      
      // 设置加载状态
      testBtn.textContent = '🚀 生成中...';
      testBtn.disabled = true;
      
      try {
        const response = await fetch('/api/news-image');
        const data = await response.json();
        
        if (data.success) {
          // 添加成功动画
          testBtn.style.background = '#52c41a';
          setTimeout(() => {
            testBtn.style.background = '';
          }, 1000);
          window.open(data.data.imageUrl, '_blank');
        } else {
          console.error('生成失败: ' + data.message);
        }
      } catch (error) {
        console.error('生成失败: ' + error.message);
      } finally {
        // 恢复按钮状态
        testBtn.textContent = originalText;
        testBtn.disabled = false;
      }
    }
    
    // 立即更新
    async function manualUpdate() {
      const updateBtn = document.querySelector('button[onclick="manualUpdate()"]');
      const originalText = updateBtn.textContent;
      
      // 设置加载状态
      updateBtn.textContent = '🔄 更新中...';
      updateBtn.disabled = true;
      
      try {
        const response = await fetch('/api/update-news');
        const data = await response.json();
        
        if (data.success) {
          // 添加成功动画
          updateBtn.style.background = '#52c41a';
          setTimeout(() => {
            updateBtn.style.background = '';
          }, 1000);
          // 刷新最后更新时间显示
          setTimeout(() => {
            loadConfig();
          }, 1000);
        } else {
          console.error('更新失败: ' + data.message);
        }
      } catch (error) {
        console.error('更新失败: ' + error.message);
      } finally {
        // 恢复按钮状态
        updateBtn.textContent = originalText;
        updateBtn.disabled = false;
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
app.get('/api/config', requireAuth, (req, res) => {
  res.json({
    success: true,
    data: config
  });
});

// API路由：保存配置
app.post('/api/config', requireAuth, (req, res) => {
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
      // 重启定时更新
      startAutoUpdate();
      
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

// 手动更新API接口
app.post('/api/update-news', requireAuth, async (req, res) => {
  try {
    console.log('=== 开始手动更新日报内容 ===');
    
    // 重新加载最新配置
    const latestConfig = loadConfig();
    console.log('当前关键词:', latestConfig.keywords);
    
    // 验证关键词
    if (!latestConfig.keywords || latestConfig.keywords.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请先在配置页面设置关键词'
      });
    }
    
    // 获取新闻
    const newsTitles = await getNewsFromOpenAI(latestConfig.keywords);
    console.log('获取到', newsTitles.length, '条新闻');
    
    // 生成图片
    const imagePath = await generateImage(newsTitles, latestConfig.keywords);
    console.log('图片生成完成:', imagePath);
    
    // 更新最后更新时间
    latestConfig.autoUpdate.lastUpdateTime = new Date().toISOString();
    saveConfig(latestConfig);
    
    console.log('=== 手动更新完成 ===');
    
    res.json({
      success: true,
      message: '日报内容更新成功',
      data: {
        imageUrl: `/${imagePath}`,
        newsCount: newsTitles.length,
        keywords: latestConfig.keywords
      }
    });
  } catch (error) {
    console.error('手动更新失败:', error.message);
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
  
  // 启动定时更新
  startAutoUpdate();
}); 