FROM node:18-alpine

WORKDIR /app

# 复制package文件
COPY package*.json ./

# 安装依赖
RUN npm install --production

# 复制源代码
COPY . .

# 创建public目录
RUN mkdir -p public

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["npm", "start"] 