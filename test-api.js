const axios = require('axios');

async function testAPI() {
  const config = {
    openai: {
      apiUrl: "https://poloai.top/v1/responses",
      apiKey: "sk-mfAWOkF5zXel1AxJAb7d37A049544d00848b7e286aEbC1E3",
      model: "gemini-2.5-flash-search"
    }
  };

  const prompt = `请搜索今天与科技相关的新闻，返回3条新闻标题，格式为JSON数组：
要求：
1. 只返回新闻标题
2. 每条标题不超过50字
3. 返回格式：[{"title": "新闻标题1"}, {"title": "新闻标题2"}]`;

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