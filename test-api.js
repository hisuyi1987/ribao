const axios = require('axios');

async function testAPI() {
  const config = {
    openai: {
      apiUrl: "https://poloai.top/v1/responses",
      apiKey: "sk-mfAWOkF5zXel1AxJAb7d37A049544d00848b7e286aEbC1E3",
      model: "gemini-2.5-flash-search"
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const prompt = `请搜索${today}（今天）和${yesterday}（昨天）这两天内与科技相关的最新新闻，返回3条新闻标题，格式为JSON数组：
要求：
1. 严格限制只返回今天和昨天（${today}和${yesterday}）的新闻
2. 每条新闻必须标注发布日期，格式为：[日期]标题
3. 绝对不要返回更早的旧新闻
4. 每条标题不超过50字
5. 确保内容多样性，每条新闻应该有明显不同的内容
6. 避免重复内容，即使表述不同也不要包含相同事件的新闻
7. 返回格式：[{"title": "[${today}]新闻标题1"}, {"title": "[${yesterday}]新闻标题2"}]`;

  try {
    console.log('测试 API 连接...');
    console.log('API地址:', config.openai.apiUrl);
    console.log('模型:', config.openai.model);
    
    const requestData = {
      input: prompt,
      model: config.openai.model,
      max_tokens: 1000,
      temperature: 0.7
    };
    
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };
    
    console.log('发送请求数据:', JSON.stringify(requestData, null, 2));
    
    const response = await axios.post(config.openai.apiUrl, requestData, { headers });
    
    console.log('✅ API 调用成功!');
    console.log('响应数据:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ API 调用失败:', error.message);
    console.error('错误详情:', error.response?.data || error);
  }
}

testAPI(); 