# 谁是卧底 (Who's Spy)

一个简约、现代、实时互动的"谁是卧底"网页游戏。无需下载 APP，打开浏览器即可与朋友联机游玩。

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-16+-green.svg)](https://nodejs.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4-black.svg)](https://socket.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## ✨ 特性

- **无需注册** - 输入昵称即可创建或加入房间
- **实时互动** - 基于 WebSocket，游戏状态秒级同步
- **断线重连** - 网络波动不掉线，自动恢复游戏状态
- **流畅体验** - 响应式设计，支持移动端和桌面端
- **可视化词牌** - 3D 翻转卡牌效果，防止窥屏
- **自动化流程** - 自动发牌、结算投票

## 🎮 游戏规则

1. **角色分配**: 玩家随机获得"平民"、"卧底"或"白板"身份
2. **查看词语**: 平民和卧底获得相似词语，白板没有词语
3. **轮流发言**: 描述自己的词语，但不能说出词语本身
4. **投票淘汰**: 投票淘汰可疑玩家，平票则进入 PK 环节
5. **胜利条件**: 
   - 卧底全部淘汰 → 平民胜利
   - 卧底数量 ≥ 平民数量 → 卧底胜利

## 🚀 快速开始

### 前置要求

- [Node.js](https://nodejs.org/) 16+
- npm 或 yarn

### 本地运行

```bash
# 克隆项目
git clone https://github.com/yourusername/whospy.git
cd whospy

# 安装依赖
npm run install-all

# 构建项目
npm run build

# 启动服务
npm start
```

服务启动后，访问 `http://localhost:3001` 开始游戏。

### 开发模式

```bash
# 并发启动前后端热更新服务
npm run dev
```

前端开发服务运行在 `http://localhost:5173`。

## 📦 部署

### 环境变量配置

复制 `.env.example` 并根据需要调整配置:

```bash
cp .env.example .env
```

主要配置项:

```env
PORT=3001                           # 服务端口
CORS_ORIGIN=https://yourdomain.com  # 允许的前端域名（生产环境）
ROOM_RECONNECT_GRACE_MS=120000      # 房间清理延迟
HOST_TRANSFER_GRACE_MS=30000        # 房主转移延迟
OFFLINE_PLAYER_REMOVE_MS=10000      # 离线玩家移除延迟
```

### PM2 部署（推荐）

```bash
# 构建项目
npm run build

# 启动服务
cd server
pm2 start dist/index.js --name "whospy"
pm2 save
pm2 startup
```

### Docker 部署

项目根目录已包含 `Dockerfile`，直接构建并运行：

```bash
docker build -t whospy .
docker run -d -p 3001:3001 --env-file .env --name whospy-app whospy
```

## 🛠️ 技术栈

**前端:**
- React 19 + TypeScript
- Vite (构建工具)
- TailwindCSS (UI 框架)
- Socket.io-client (实时通信)

**后端:**
- Node.js + Express
- Socket.io (WebSocket 服务)
- TypeScript
- In-Memory State (适合小规模部署)

**架构特点:**
- Monorepo 结构，前后端类型共享
- 依赖注入模式，易于测试和扩展
- 模块化设计，职责清晰

详细架构说明请参考 [ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 📁 项目结构

```
whospy/
├── shared/          # 前后端共享类型定义
├── client/          # React 前端
├── server/          # Express + Socket.io 后端
├── docs/            # 项目文档
└── package.json     # 根目录脚本
```

## 🧪 开发指南

### 常见任务

**修改词库:**
```bash
# 编辑词库文件
vi server/src/game/wordbank/default.json
```

**添加新的 Socket 事件:**
1. 后端在 `SocketHandler.ts` 添加事件监听
2. 前端在 `SocketContext.tsx` 添加 emit 方法
3. 在 `shared/types.ts` 定义数据结构

### 调试

**Socket 事件调试:**
- Chrome DevTools → Network → WS
- 浏览器控制台查看 Socket.IO 日志

**后端日志:**
```bash
cd server
npm run dev  # 控制台输出实时日志
```

## 🤝 贡献

欢迎提交 Issue 或 Pull Request！

**开发流程:**
1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交变更 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

## 📝 常见问题

**Q: 服务重启后房间丢失？**  
A: 当前使用内存存储，服务重启会清空所有房间。小规模项目无影响，大规模可接入 Redis。

**Q: 如何支持更多并发？**  
A: 当前架构支持 5-10 个房间，20-50 人在线。需要更大规模请参考 [ARCHITECTURE.md](docs/ARCHITECTURE.md) 的扩展方案。

**Q: 前端连接不上后端？**  
A: 检查 CORS 配置和端口设置，开发环境确保前端 Vite 运行在 5173 端口。

## 📄 License

MIT © Who's Spy Team

---

**Made with ❤️ by the Who's Spy Team**
