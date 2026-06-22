# 项目架构说明

## 📁 目录结构

```
whospy/
├── shared/                  # 前后端共享类型定义
│   └── types.ts            # Player, GameConfig, GameState, RoomData
├── server/
│   └── src/
│       ├── index.ts        # 入口文件 (86行)
│       ├── types.ts        # 类型导出
│       ├── game/
│       │   ├── Room.ts     # 房间游戏逻辑 (813行)
│       │   ├── RoomManager.ts
│       │   ├── words.ts
│       │   └── wordbank/
│       ├── handlers/
│       │   └── SocketHandler.ts  # Socket事件处理器 (376行)
│       ├── services/
│       │   └── TimerService.ts   # 定时器管理 (98行)
│       └── utils/
│           ├── validators.ts     # 输入验证
│           └── random.ts
└── client/
    └── src/
        ├── types.ts        # 类型导出 + 工具函数
        ├── context/
        │   └── SocketContext.tsx
        ├── pages/
        └── components/
```

## 🔧 核心架构改进

### 1. 代码模块化
**优化前：**
- `index.ts`: 514 行（验证、定时器、Socket处理全混在一起）

**优化后：**
- `index.ts`: 86 行（仅负责应用启动和依赖注入）
- `SocketHandler.ts`: 376 行（专注Socket事件处理）
- `TimerService.ts`: 98 行（集中管理所有定时器）
- `validators.ts`: 32 行（输入验证逻辑）

### 2. 类型共享
**优化前：**
- 前端 `client/src/types.ts` 和后端 `server/src/types.ts` 定义重复
- 需要手动同步类型变更

**优化后：**
- 创建 `shared/types.ts` 作为唯一真实来源
- 前后端通过 `export * from '../../shared/types'` 引用
- TypeScript 编译时自动包含共享类型

### 3. 职责分离
| 模块 | 职责 |
|------|------|
| `index.ts` | Express/Socket.IO 初始化，CORS 配置，静态文件托管 |
| `SocketHandler` | Socket 连接管理，事件路由，房间状态同步 |
| `TimerService` | 房间清理、房主转移、离线玩家移除的定时器管理 |
| `Room` | 游戏核心逻辑（发牌、回合、投票、胜负判定） |
| `RoomManager` | 房间生命周期管理（创建、加入、删除） |
| `validators` | 用户输入验证和清洗 |

## 🔌 依赖注入模式

```typescript
// server/src/index.ts
const roomManager = new RoomManager();
const timerService = new TimerService(
  ROOM_RECONNECT_GRACE_MS,
  HOST_TRANSFER_GRACE_MS,
  OFFLINE_PLAYER_REMOVE_MS
);
const socketHandler = new SocketHandler(io, roomManager, timerService);

io.on('connection', (socket) => {
  socketHandler.handleConnection(socket);
});
```

**优势：**
- 易于单元测试（可注入 Mock）
- 清晰的依赖关系
- 便于替换实现（如未来接入 Redis）

## 🎯 保持的设计决策

以下保持不变，符合小项目需求：

1. **内存存储** - `RoomManager` 仍用 `Map` 存储房间，适合 <5 房间规模
2. **单服务器架构** - 未引入 Redis/消息队列，避免过度设计
3. **Room 类职责** - 813 行虽然较长，但游戏逻辑内聚性强，不强行拆分

## 🚀 运行项目

### 开发模式
```bash
npm run dev        # 前后端热更新
```

### 生产部署
```bash
npm run build      # 构建前后端
cd server && npm start
```

### 环境变量
复制 `.env.example` 为 `.env` 自定义配置：
```bash
PORT=3001
ROOM_RECONNECT_GRACE_MS=120000
HOST_TRANSFER_GRACE_MS=30000
OFFLINE_PLAYER_REMOVE_MS=10000
```

## 📈 后续优化建议

**当流量增长时考虑：**
1. 引入 Redis 持久化房间状态（日活 >100 人）
2. Socket.IO Redis Adapter 支持多实例负载均衡
3. 添加 Winston 日志系统
4. 前端引入 Zustand 状态管理

**当前无需实施，保持简洁优先。**
