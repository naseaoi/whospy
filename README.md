# 谁是卧底 (Who's Spy)

一个简约、现代、实时互动的“谁是卧底”网页游戏。无需下载 APP，打开浏览器即可与朋友联机游玩。

![Screenshot Placeholder](https://via.placeholder.com/800x400?text=Whos+Spy+Game+Screenshot)

## ✨ 特性

*   **无需注册**: 输入昵称即可创建或加入房间。
*   **实时互动**: 基于 WebSocket，游戏状态秒级同步。
*   **流畅体验**: 精心设计的 UI/UX，支持移动端和桌面端，包含平滑的动画效果。
*   **自动化流程**: 自动发牌、自动倒计时、自动结算投票结果。
*   **可视化词牌**: 3D 翻转卡牌效果查看词语，防止窥屏。

## 🚀 快速开始

### 1. 本地运行

确保你的环境已安装 [Node.js](https://nodejs.org/) (v16+)。

```bash
# 克隆项目
git clone https://github.com/yourusername/whospy.git
cd whospy

# 一键安装所有依赖 (根目录、client、server)
npm run install-all

# 一键构建项目
npm run build

# 启动服务
npm start
```

服务启动后，访问 `http://localhost:3001` 即可开始游戏。

### 2. 开发模式

如果你需要修改代码，建议分别启动前后端的热更新服务：

**Server (后端):**
```bash
cd server
npm run dev
```

**Client (前端):**
```bash
cd client
npm run dev
```

## 🛠️ 部署指南

本项目采用 **前后端同构** 的部署方式：前端构建为静态资源，由后端 Express 服务器统一托管。这意味着你只需要部署一个 Node.js 服务即可。

### 方案 A: 云服务器 (VPS) - 推荐

适用于拥有 Linux 服务器（如 Ubuntu/CentOS）的用户。

**步骤:**

1.  **环境准备**:
    *   在服务器上安装 Node.js (v16+) 和 NPM。
    *   安装 PM2 进程管理器: `npm install -g pm2`

2.  **上传代码**:
    *   将项目代码上传至服务器（可以使用 git clone 或 scp）。

3.  **安装与构建**:
    ```bash
    cd whospy
    npm run install-all
    npm run build
    ```

4.  **启动服务 (使用 PM2 持久化)**:
    ```bash
    # 进入 server 目录启动
    cd server
    
    # 使用 pm2 启动并命名为 whospy
    pm2 start dist/index.js --name "whospy"
    
    # 保存当前进程列表，确保重启服务器后自动启动
    pm2 save
    pm2 startup
    ```

5.  **配置防火墙/Nginx (可选)**:
    *   确保服务器防火墙开放了 `3001` 端口。
    *   或者配置 Nginx 反向代理将 80/443 端口转发到 3001。

### 方案 B: Docker 部署

1.  **构建镜像**:
    ```bash
    docker build -t whospy .
    ```
    *(需在根目录创建 Dockerfile，参见下方示例)*

2.  **运行容器**:
    ```bash
    docker run -d -p 3001:3001 --name whospy-app whospy
    ```

---

## 📂 项目结构

详情请查阅 [维护指南](docs/MAINTAINERS.md)。

## 🤝 贡献

欢迎提交 Issue 或 Pull Request 来改进游戏体验！

## 📄 License

MIT
