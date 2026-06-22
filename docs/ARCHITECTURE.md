# 谁是卧底 (Who's Spy) - 项目架构与维护指南

## 1. 项目概览

基于 WebSockets 的实时多人"谁是卧底"网页游戏。采用 Monorepo 结构，前后端分离开发，统一部署。

**架构设计原则：** 针对小规模项目（<5 房间，<20 人）保持简洁，避免过度工程化，同时确保代码可维护性和可扩展性。

### 技术栈

**前端 (Client):**
- React 18 (TypeScript)
- Vite (构建工具)
- TailwindCSS (UI 样式)
- Socket.io-client (实时通信)

**后端 (Server):**
- Node.js (Express)
- Socket.io (实时通信核心)
- TypeScript (类型安全)
- In-Memory State (游戏状态保存在内存，适合小规模部署)

---

## 2. 目录结构

```
whospy/
├── shared/                     # 前后端共享
│   └── types.ts               # 类型定义（唯一数据源）
│
├── server/src/
│   ├── index.ts               # 入口文件
│   ├── types.ts               # 类型导出
│   ├── game/                  # 游戏逻辑层
│   │   ├── Room.ts           # 房间状态机
│   │   ├── RoomManager.ts    # 房间管理
│   │   ├── words.ts
│   │   └── wordbank/         # 词库数据文件
│   ├── handlers/              # 事件处理层
│   │   └── SocketHandler.ts  # Socket 事件路由
│   ├── services/              # 业务服务层
│   │   └── TimerService.ts   # 定时器管理
│   └── utils/                 # 工具层
│       ├── validators.ts     # 输入验证
│       └── random.ts
│
└── client/src/
    ├── types.ts              # 类型导出 + 工具函数
    ├── context/              # React Context (SocketContext)
    ├── pages/                # 页面组件 (Home, Lobby, GameRoom)
    ├── components/           # UI 组件 (Modal)
    ├── App.tsx
    └── main.tsx
```

---

## 3. 架构设计

### 3.1 分层架构

```
┌─────────────────────────────────┐
│   Entry Layer (index.ts)       │  启动配置、依赖注入
├─────────────────────────────────┤
│   Handler Layer                 │  Socket 事件路由
│   - SocketHandler               │  
├─────────────────────────────────┤
│   Service Layer                 │  业务服务
│   - TimerService                │  
├─────────────────────────────────┤
│   Business Logic Layer          │  核心业务
│   - Room (状态机)               │  
│   - RoomManager (生命周期)      │  
├─────────────────────────────────┤
│   Utility Layer                 │  通用工具
│   - validators                  │  
│   - random                      │  
└─────────────────────────────────┘
```

### 3.2 依赖注入模式

```typescript
// 依赖创建
const roomManager = new RoomManager();
const timerService = new TimerService(...);
const socketHandler = new SocketHandler(io, roomManager, timerService);

// 事件注册
io.on('connection', (socket) => {
  socketHandler.handleConnection(socket);
});
```

**优势：**
- 解耦各模块，易于单元测试
- 依赖关系清晰，便于理解数据流
- 方便替换实现（如未来接入 Redis）

### 3.3 类型系统设计

**共享类型机制：**
```typescript
// shared/types.ts - 唯一数据源
export interface Player { ... }
export interface GameState { ... }

// server/src/types.ts - 重导出
export * from '../../shared/types';

// client/src/types.ts - 重导出
export * from '../../shared/types';
```

**优势：**
- 前后端类型定义一致，避免不同步
- 修改类型只需编辑一处
- TypeScript 编译时自动检查

**核心类型：**
- `Player` - 玩家数据（角色、词语、状态）
- `GameConfig` - 游戏配置（卧底数、白板数、词库）
- `GameState` - 游戏状态（阶段、回合、投票结果）
- `RoomData` - 房间完整数据

**TypeScript 配置：**
```json
// server/tsconfig.json
{
  "include": ["src/**/*", "../shared/**/*"],
  "compilerOptions": {
    "outDir": "./dist"
  }
}
```

---

## 4. 核心模块详解

### 4.1 SocketHandler (事件处理层)

**职责：** Socket 连接管理和事件路由

**核心方法：**
- `handleConnection()` - 注册所有事件监听器
- `handleCreateRoom()` - 创建房间
- `handleJoinRoom()` / `handleRejoinRoom()` - 加入/重连
- `handleStartGame()` - 开始游戏
- `handleVote()` - 处理投票
- `emitRoomUpdate()` - 广播房间状态

**设计亮点：**
- 事件处理器统一命名 `handle*`
- 每个处理器职责单一
- 使用 `try-catch` 统一错误处理

### 4.2 TimerService (定时器管理)

**职责：** 集中管理所有定时器，防止泄漏

**管理的定时器：**
- `roomCleanupTimers` - 房间清理（全员离线后）
- `hostTransferTimers` - 房主转移（房主离线后）
- `offlinePlayerTimers` - 离线玩家移除

**核心方法：**
- `schedule*(roomId, callback)` - 调度定时任务
- `clear*(roomId)` - 清除定时任务
- `clearAllOfflinePlayersForRoom(roomId)` - 批量清理

**设计亮点：**
- 使用 Map 管理定时器，key 为 roomId
- 自动去重：重复调度会忽略
- 回调完成后自动删除 Map 条目

### 4.3 Room (游戏逻辑层)

**职责：** 游戏状态机和核心玩法逻辑

**核心功能：**
- 玩家管理（加入、离线、重连、移除）
- 角色分配（Fisher-Yates 洗牌）
- 游戏流程控制（看词 → 描述 → 投票 → 结算）
- 投票逻辑（平票 PK、淘汰判定）
- 胜负条件判断

**状态机流转：**
```
WAITING → VIEWING → DESCRIBING → VOTING → VOTE_RESULT
                                     ↓
                                 PK_ANNOUNCEMENT → PK_DESCRIBING → PK_VOTING
                                                                        ↓
                                                                   VOTE_RESULT
```

**设计亮点：**
- 私有方法管理内部状态（`startTurn()`, `resolveVotes()`）
- `toDataForPlayer(viewerId)` 为不同玩家过滤可见数据
- 通过 `onUpdate` 回调解耦状态同步

### 4.4 RoomManager (房间管理)

**职责：** 房间生命周期管理

**核心功能：**
- `createRoom()` - 生成 6 位房间号并创建 Room 实例
- `joinRoom()` - 加入房间或重连
- `reconnectRoom()` - 通过 token 恢复玩家身份
- `deleteRoom()` - 清理房间资源

**设计亮点：**
- 使用 Map 存储房间（内存存储，适合小规模）
- 6 位房间号生成有冲突重试（最多 20 次）

### 4.5 validators (输入验证)

**职责：** 清洗和验证用户输入

**验证规则：**
- `normalizePlayerName()` - 昵称不为空，最多 20 字符
- `normalizeAvatar()` - 头像不为空，最多 16 字符
- `normalizeRoomId()` - 6 位数字
- `normalizePlayerToken()` - 16-128 位字母数字

**设计亮点：**
- 统一抛出中文错误消息
- 自动 trim 和截断

---

## 5. 通信与数据流

### 5.1 通信机制

**双向通信：**
- 前端 `socket.emit('action', data)` → 后端处理
- 后端 `socket.emit('room_updated', roomData)` → 前端更新

**状态同步：**
- 前端是纯 View 层，渲染后端下发的状态
- 所有业务逻辑在后端校验
- Room 通过 `toDataForPlayer(viewerId)` 为不同玩家过滤可见数据

### 5.2 数据流示例

**用户加入房间：**
```
Client                          Server
  │                               │
  ├─ emit('join_room') ───────────▶ SocketHandler.handleJoinRoom()
  │                               ├─ validators.normalize*()
  │                               ├─ RoomManager.joinRoom()
  │                               │   └─ Room.addPlayer()
  │                               ├─ TimerService.clear*()
  │                               └─ emitRoomUpdate()
  │                                   └─ Room.toDataForPlayer()
  ◀── emit('room_updated') ───────┤
  │                               │
```

**玩家断线重连：**
```
Client                          Server
  │                               │
  ├─ disconnect ──────────────────▶ SocketHandler.handleDisconnect()
  │                               ├─ Room.markPlayerOffline()
  │                               ├─ TimerService.scheduleOfflinePlayerRemoval()
  │                               └─ emitRoomNotice("XX 掉线了")
  │                               │
  ├─ reconnect ───────────────────▶ SocketHandler.handleRejoinRoom()
  │                               ├─ RoomManager.reconnectRoom()
  │                               │   └─ Room.reconnectPlayer()
  │                               │       └─ 更新 socketId，恢复 isOnline
  │                               ├─ TimerService.clearOfflinePlayer()
  │                               └─ emitRoomUpdate()
  ◀── emit('room_updated') ───────┤
```

### 5.3 断线重连机制

**实现逻辑：**
1. 客户端生成 `playerToken` 存储在 `sessionStorage`
2. 玩家加入房间时，后端记录 `token ↔ playerId` 映射
3. 断线后 Socket.IO 自动尝试重连，触发 `rejoin_room` 事件
4. 后端通过 token 恢复玩家身份（更新 socketId）

**定时清理：**
- 离线超过 `OFFLINE_PLAYER_REMOVE_MS`（默认 10 秒）自动移除
- 房主离线超过 `HOST_TRANSFER_GRACE_MS`（默认 30 秒）转移房主
- 房间所有人离线超过 `ROOM_RECONNECT_GRACE_MS`（默认 120 秒）删除房间

---

## 6. 技术决策

### 6.1 保持的设计（适合小项目）

✅ **内存存储** - 无需 Redis，简化部署  
✅ **单服务器架构** - 无需消息队列  
✅ **Console 日志** - 无需日志框架  
✅ **Context API** - 无需 Redux/Zustand  

### 6.2 未来可选优化（流量增长后）

⏳ **Redis 持久化** - 支持服务重启不丢失房间  
⏳ **Socket.IO Redis Adapter** - 多实例负载均衡  
⏳ **Winston 日志** - 结构化日志和日志轮转  
⏳ **状态管理库** - 前端性能优化  

### 6.3 明确不需要的（避免过度设计）

❌ 微服务拆分  
❌ GraphQL  
❌ Kubernetes  
❌ 消息队列  

### 6.4 性能考虑

**当前架构支持的规模：**
- 并发房间数：5-10 个
- 在线玩家数：20-50 人
- 内存占用：< 100 MB

**性能优化点：**
1. 状态同步优化 - `toDataForPlayer()` 只发送玩家可见数据
2. 定时器管理 - 及时清理避免泄漏
3. 事件处理异步 - 使用 `try-catch` 避免阻塞

**扩展瓶颈：**
当达到以下情况需要架构升级：
- 并发房间 > 50
- 在线用户 > 200
- 服务器内存 > 500 MB

### 6.5 安全设计

**输入验证：**
- 所有用户输入经过 `validators` 清洗
- 长度限制防止恶意输入
- 正则表达式验证格式

**CORS 配置：**
```typescript
// 开发环境：允许 localhost
// 生产环境：通过 CORS_ORIGIN 环境变量配置白名单
const isOriginAllowed = (origin?: string) => {
  if (configuredOrigins.length === 0 && process.env.NODE_ENV === 'production') {
    return true;  // 同源部署自动放行
  }
  return allowedOrigins.includes(origin);
};
```

**身份验证：**
- 使用 `playerToken` 防止身份冒充
- Token 格式：16-128 位字母数字
- 存储在 `sessionStorage`，刷新页面可重连

---

## 7. 开发与调试

### 7.1 环境配置

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

### 7.2 启动开发环境

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

### 7.3 常见维护任务

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

### 7.4 调试方法

**调试 Socket 事件：**
- 浏览器控制台查看 Socket.IO 日志
- Chrome DevTools → Network → WS 标签

**常见问题排查：**
- 前端类型错误：确保 `npm run build` 时 TypeScript 编译通过
- CORS 错误：检查 Vite 端口或设置 `CORS_ORIGIN` 环境变量
- 服务重启后房间丢失：正常现象，当前使用内存存储

---

## 8. 部署

### 8.1 构建与启动

```bash
# 一键构建前后端
npm run build

# 启动生产服务
npm start
```

服务启动在 `PORT` 端口（默认 3001），同时提供：
- WebSocket 服务
- 静态文件托管（前端构建产物）

### 8.2 部署方式

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

### 8.3 生产环境注意

- 设置 `NODE_ENV=production`
- 配置 `CORS_ORIGIN` 限制允许的域名
- 使用 Nginx 反向代理（可选）

---

## 9. 总结

本架构在**简洁性**和**可维护性**之间取得平衡：
- 模块化设计便于理解和扩展
- 依赖注入支持测试和替换
- 类型共享避免前后端不一致
- 适度设计避免过度工程化

适合 5-50 人规模的实时游戏项目，后续可根据流量增长逐步优化。
