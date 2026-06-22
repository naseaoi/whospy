# 谁是卧底 (Who's Spy) - 项目维护指南

## 1. 项目概览

基于 **WebSockets** 的实时多人"谁是卧底"网页游戏。采用 **Monorepo** 结构，前后端分离开发，统一部署。

### 技术栈

**前端 (Client):**
- **React 19** (TypeScript)
- **Vite** (构建工具)
- **TailwindCSS** (UI 样式)
- **Socket.io-client** (实时通信)

**后端 (Server):**
- **Node.js** (Express)
- **Socket.io** (实时通信核心)
- **TypeScript** (类型安全)
- **In-Memory State** (游戏状态保存在内存，适合小规模部署)

## 2. 项目结构

```text
whospy/
├── shared/                     # 前后端共享类型定义
│   └── types.ts               # Player, GameConfig, GameState, RoomData
│
├── client/                    # 前端 React 项目
│   ├── src/
│   │   ├── components/        # UI 组件 (Modal)
│   │   ├── context/           # SocketContext (Socket 连接管理)
│   │   ├── pages/             # Home, Lobby, GameRoom
│   │   ├── types.ts           # 类型导出 + 工具函数
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── dist/                  # 构建产物
│
├── server/                    # 后端 Express 项目
│   ├── src/
│   │   ├── game/
│   │   │   ├── Room.ts        # 房间状态机和游戏逻辑
│   │   │   ├── RoomManager.ts # 房间生命周期管理
│   │   │   ├── words.ts       # 词库
│   │   │   └── wordbank/      # 词库数据文件
│   │   ├── handlers/
│   │   │   └── SocketHandler.ts  # Socket 事件处理
│   │   ├── services/
│   │   │   └── TimerService.ts   # 定时器管理
│   │   ├── utils/
│   │   │   ├── validators.ts     # 输入验证
│   │   │   └── random.ts
│   │   ├── index.ts           # 入口文件
│   │   └── types.ts           # 类型导出
│   └── dist/                  # 构建产物
│
├── docs/                      # 项目文档
├── .env.example               # 环境变量模板
├── package.json               # 根目录脚本
└── README.md
```

## 3. 核心架构

### 3.1 模块职责

| 模块 | 职责 |
|------|------|
| `index.ts` | 应用启动、Express/Socket.IO 初始化、CORS 配置 |
| `SocketHandler` | Socket 连接管理、事件路由、房间状态同步 |
| `TimerService` | 定时器管理（房间清理、房主转移、离线玩家移除） |
| `Room` | 游戏核心逻辑（发牌、回合、投票、胜负判定） |
| `RoomManager` | 房间生命周期管理（创建、加入、删除） |
| `validators` | 用户输入验证和清洗 |

### 3.2 游戏状态流转

`Room.ts` 实现的状态机：

1. **WAITING** → 等待玩家加入
2. **VIEWING** → 游戏开始，玩家查看词语
3. **DESCRIBING** → 按顺序描述
4. **VOTING** → 投票阶段
5. **VOTE_RESULT** → 结果展示，确认后进入下一轮
6. **PK_ANNOUNCEMENT** → 平票时进入 PK 公告
7. **PK_DESCRIBING** → PK 玩家发言
8. **PK_VOTING** → PK 投票
9. **GAME_OVER** → 胜负结算

### 3.3 通信机制

**双向通信：**
- 前端 `socket.emit('action', data)` → 后端处理
- 后端 `socket.emit('room_updated', roomData)` → 前端更新

**状态同步：**
- 前端是纯 View 层，渲染后端下发的状态
- 所有业务逻辑在后端校验
- Room 通过 `toDataForPlayer(viewerId)` 为不同玩家过滤可见数据

### 3.4 断线重连机制

**实现逻辑：**
1. 客户端生成 `playerToken` 存储在 `sessionStorage`
2. 玩家加入房间时，后端记录 `token ↔ playerId` 映射
3. 断线后 Socket.IO 自动尝试重连，触发 `rejoin_room` 事件
4. 后端通过 token 恢复玩家身份（更新 socketId）

**定时清理：**
- 离线超过 `OFFLINE_PLAYER_REMOVE_MS`（默认 10 秒）自动移除
- 房主离线超过 `HOST_TRANSFER_GRACE_MS`（默认 30 秒）转移房主
- 房间所有人离线超过 `ROOM_RECONNECT_GRACE_MS`（默认 120 秒）删除房间

## 4. 开发与调试

### 4.1 环境配置

复制环境变量模板：
```bash
cp .env.example .env
```

可配置参数：
```bash
PORT=3001                           # 服务端口
ROOM_RECONNECT_GRACE_MS=120000      # 房间清理时间
HOST_TRANSFER_GRACE_MS=30000        # 房主转移时间
OFFLINE_PLAYER_REMOVE_MS=10000      # 离线玩家移除时间
```

### 4.2 启动开发环境

**方式 1：分别启动（推荐开发）**
```bash
# 终端 1 - 后端热更新
cd server && npm run dev

# 终端 2 - 前端热更新
cd client && npm run dev
```

**方式 2：并发启动**
```bash
npm run dev  # 根目录执行
```

访问 `http://localhost:5173` 进入游戏。

### 4.3 常见维护任务

**修改词库：**
- 编辑 `server/src/game/wordbank/*.json` 或 `words.ts`

**调整游戏时间：**
- `Room.ts` 中修改 `DURATION_VIEWING`、`DURATION_DESCRIBING`

**修改 UI：**
- 页面：`client/src/pages/`
- 组件：`client/src/components/`
- 样式：使用 TailwindCSS，3D 卡牌动画在 `client/src/index.css`

**添加新的 Socket 事件：**
1. 在 `SocketHandler.ts` 中添加事件监听
2. 在 `Room.ts` 或 `RoomManager.ts` 中实现逻辑
3. 前端在 `SocketContext.tsx` 中添加对应的 emit 方法

## 5. 部署

### 5.1 构建与启动

```bash
# 一键构建前后端
npm run build

# 启动生产服务
npm start
```

服务启动在 `PORT` 端口（默认 3001），同时提供：
- WebSocket 服务
- 静态文件托管（前端构建产物）

### 5.2 部署方式

**推荐：PM2 部署**
```bash
cd server
pm2 start dist/index.js --name "whospy"
pm2 save
pm2 startup
```

**Docker 部署**
- 需自行编写 Dockerfile
- 构建顺序：`npm run install-all` → `npm run build`

### 5.3 生产环境注意

- 设置 `NODE_ENV=production`
- 配置 `CORS_ORIGIN` 限制允许的域名
- 使用 Nginx 反向代理（可选）

## 6. 类型系统

### 6.1 共享类型

`shared/types.ts` 作为唯一数据源，前后端通过 `export *` 引用：

```typescript
// server/src/types.ts
export * from '../../shared/types';

// client/src/types.ts
export * from '../../shared/types';
```

修改类型定义只需编辑 `shared/types.ts`，编译时自动同步。

### 6.2 核心类型

- `Player` - 玩家数据（角色、词语、状态）
- `GameConfig` - 游戏配置（卧底数、白板数、词库）
- `GameState` - 游戏状态（阶段、回合、投票结果）
- `RoomData` - 房间完整数据

## 7. 后续优化建议

### 7.1 当前阶段（适合 <5 房间，<20 人）
✅ 代码已模块化，职责清晰  
✅ 类型安全，减少运行时错误  
✅ 断线重连机制完善

### 7.2 流量增长后（>100 DAU）
1. **引入 Redis** - 持久化房间状态，支持服务重启
2. **Socket.IO Redis Adapter** - 多实例负载均衡
3. **日志系统** - Winston/Pino 替代 console.log
4. **监控告警** - Socket.IO Admin UI

### 7.3 不建议的优化
❌ 微服务拆分（过度设计）  
❌ GraphQL（REST + Socket.IO 已足够）  
❌ Kubernetes（单容器部署即可）

## 8. 常见问题

**Q: 服务重启后房间丢失？**  
A: 正常现象，当前使用内存存储。小规模项目无需持久化，流量增长后可接入 Redis。

**Q: 如何调试 Socket 事件？**  
A: 浏览器控制台查看 Socket.IO 日志，或使用 Chrome DevTools 的 Network → WS 标签。

**Q: 前端类型错误？**  
A: 确保 `npm run build` 时 TypeScript 编译通过，`shared/types.ts` 会被包含到编译输出。

**Q: CORS 错误？**  
A: 开发环境检查 Vite 是否运行在 5173 端口；生产环境设置 `CORS_ORIGIN` 环境变量。
