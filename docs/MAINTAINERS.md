# 谁是卧底 (Who's Spy) - 项目维护指南

## 1. 项目概览

这是一个基于 **WebSockets** 的实时多人“谁是卧底”网页游戏。项目采用 **Monorepo** 结构，前后端分离开发，统一部署。

### 技术栈

*   **前端 (Client):**
    *   **React 18** (TypeScript)
    *   **Vite** (构建工具)
    *   **TailwindCSS** (UI 样式)
    *   **Socket.io-client** (实时通信)
*   **后端 (Server):**
    *   **Node.js** (Express)
    *   **Socket.io** (实时通信核心)
    *   **TypeScript** (类型安全)
    *   **In-Memory State** (目前游戏状态保存在内存中，重启服务器会丢失房间信息)

## 2. 项目结构

```text
root/
├── client/                 # 前端 React 项目
│   ├── src/
│   │   ├── components/     # 通用 UI 组件 (Modal 等)
│   │   ├── context/        # React Context (Socket 上下文)
│   │   ├── hooks/          # 自定义 Hooks
│   │   ├── pages/          # 页面组件 (GameRoom, Home, Lobby)
│   │   ├── App.tsx         # 路由配置
│   │   └── main.tsx        # 入口文件
│   └── dist/               # 前端构建产物 (由 npm run build 生成)
│
├── server/                 # 后端 Express 项目
│   ├── src/
│   │   ├── game/           # 游戏核心逻辑 (Room, RoomManager)
│   │   │   ├── Room.ts     # 单个房间的状态机逻辑
│   │   │   ├── RoomManager.ts # 房间管理 (创建/销毁)
│   │   │   └── words.ts    # 词库配置
│   │   └── index.ts        # 服务器入口 (Socket.io 事件监听)
│   └── dist/               # 后端构建产物 (由 npm run build 生成)
│
├── docs/                   # 项目文档
├── package.json            # 根目录配置 (包含一键启动脚本)
└── README.md               # 项目说明
```

## 3. 核心逻辑说明

### 3.1 游戏状态流转 (State Machine)
`server/src/game/Room.ts` 是核心。游戏状态 (`gameState.phase`) 流转如下：

1.  **WAITING**: 初始状态，等待玩家加入。
2.  **VIEWING**: 游戏开始，分配词语，玩家查看自己的词。
3.  **DESCRIBING**: 玩家按顺序轮流描述。
4.  **VOTING**: 所有玩家描述完毕，进入投票阶段。
5.  **VOTE_RESULT**: 投票结果展示（谁被投出局）。
6.  **GAME_OVER**: 胜利条件达成（卧底胜利或平民胜利）。

### 3.2 通信机制
*   **双向通信**: 前端通过 `socket.emit` 发送动作（如 `start_game`, `vote`），后端处理后通过 `io.to(roomId).emit('room_updated', roomData)` 广播最新的房间状态。
*   **状态同步**: 前端是一个纯粹的 View 层，渲染后端发来的 `roomData`。所有业务逻辑判断（如是否能开始游戏、是否轮到该玩家）都在后端校验。

## 4. 开发与调试

### 4.1 启动开发环境

你需要两个终端窗口：

**终端 1 (Server):**
```bash
cd server
npm run dev
# 运行在 http://localhost:3001
```

**终端 2 (Client):**
```bash
cd client
npm run dev
# 运行在 http://localhost:5173
```
*注意：开发模式下，前端 Vite 服务器会代理 API 请求到后端 3001 端口（配置在 `client/vite.config.ts`）。*

### 4.2 常见维护任务

*   **修改词库**: 编辑 `server/src/game/words.ts`。
*   **调整游戏时间**: 在 `server/src/game/Room.ts` 中搜索 `PHASE_TIME` 常量。
*   **修改 UI**: 主要集中在 `client/src/pages/GameRoom.tsx`。注意该文件使用了 TailwindCSS，且包含了一些针对 3D 卡牌翻转的自定义 CSS（在 `client/src/index.css`）。

## 5. 部署注意事项

*   **构建顺序**: 必须先构建前端 (`client`)，因为后端在运行时会托管前端生成的静态文件。
*   **根目录脚本**: 根目录的 `package.json` 提供了 `npm run build` 脚本，会自动按顺序构建前后端。
*   **生产环境运行**: 生产环境只需运行后端 `node server/dist/index.js`，它会同时提供 API 服务和静态页面服务。

## 6. 后续优化建议

1.  **持久化**: 目前重启服务器会导致房间数据丢失。可以引入 Redis 来存储 `RoomManager` 的状态。
2.  **断线重连**: 目前简单的断线重连已有实现（根据 socketId），但更稳健的做法是引入用户 Token 机制，防止刷新页面后 socketId 变更导致无法回到原房间。
3.  **移动端适配**: 虽然使用了响应式布局，但针对不同尺寸的手机屏幕（尤其是 Safari 浏览器底部的地址栏）可能还需要微调 CSS。
