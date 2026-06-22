FROM node:18-alpine

WORKDIR /app

# 复制依赖配置
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/
COPY shared ./shared

# 安装依赖
RUN npm run install-all

# 复制源码
COPY client ./client
COPY server ./server

# 构建
RUN npm run build

# 暴露端口
EXPOSE 3001

# 启动服务
CMD ["npm", "start"]
