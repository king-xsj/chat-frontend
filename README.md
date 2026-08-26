# chat-frontend

对接 `code-assistant-agent` 后端的 **Vue 3 流式聊天前端**。通过 `fetch` + `ReadableStream` 逐行解析后端推送的 NDJSON 事件，实现助手回复的**逐字流式输出**；使用 Element Plus 搭建界面、`marked` + `DOMPurify` 渲染 Markdown。

## 技术栈

| 分类 | 技术 |
|------|------|
| 框架 | Vue 3（Composition API + `<script setup>`） |
| 语言 | TypeScript + SCSS |
| 构建 | Vite 6 |
| UI 组件库 | Element Plus + `@element-plus/icons-vue` |
| Markdown | `marked`（解析）+ `dompurify`（XSS 消毒） |

## 目录结构

```
src/
├── main.ts                    # 应用入口：注册 Element Plus + 引入全局样式
├── App.vue                    # 布局（el-container）+ 滚动容器 + 滚动策略
├── api/
│   └── chat.ts                # streamChat()：fetch + ReadableStream 解析 NDJSON
├── composables/
│   └── useChat.ts             # 消息状态、流式累积、sessionId 管理
├── components/
│   ├── ChatMessage.vue        # 单条消息：头像/气泡/Markdown/工具标签/加载动画
│   └── ChatInput.vue          # 输入框 + 发送按钮（Enter 发送 / Shift+Enter 换行）
├── types/
│   └── chat.ts                # ChatMessage / StreamEvent 类型定义
└── styles/
    └── main.scss              # 全局重置 + Markdown 排版样式
```

## 模块实现思路

### 1. API 层（`api/chat.ts`）

`streamChat(message, sessionId, onEvent, signal)` 负责调用后端流式接口并逐事件回调：

- `fetch(\`${VITE_API_BASE}/api/chat/stream\`, { method: "POST", body: JSON.stringify({ message, sessionId }), signal })`。
- 用 `res.body.getReader()` + `TextDecoder` 读取字节流，按 `\n` 切行、逐行 `JSON.parse`。
- 关键点：维护一个 `buffer` 保存**跨 chunk 的半行残留**——每次 `split("\n")` 后把最后一段 `pop()` 回 buffer，下次拼接，避免一个事件被 TCP 分包切断后解析失败。
- 支持 `AbortSignal` 传入以取消请求。

### 2. 状态管理（`composables/useChat.ts`）

- `messages` 用 `ref<ChatMessage[]>([])` 存放整轮对话；`streaming` 标记是否正在流式输出。
- `send()` 流程：先 push 一条用户消息 → 新建一条 `status: "streaming"` 的助手消息 → 调用 `streamChat` 逐事件更新：
  - `token`：追加 `assistant.content`；
  - `tool_start` / `tool_end`：维护 `activeTools` 数组，用于展示「🔧 工具名」标签；
  - `error` / `done`：收尾并更新状态。
- **响应式陷阱**：助手消息用 `reactive<ChatMessage>()` 包裹后再 push。若直接 push 一个普通对象，后续对 `assistant.content` 的原地修改不会经过 Vue 的响应式代理，界面不会更新。
- `sessionId` 存入 `localStorage`（key `chat-session-id`），无则 `crypto.randomUUID()` 生成（带降级兜底），保证多轮对话复用同一会话记忆。

### 3. 消息渲染（`components/ChatMessage.vue`）

- 头像与气泡位置：助手头像在左（`Monitor` 图标）、用户头像在右（`User` 图标）；用户消息用 `justify-content: flex-end` 把整体靠右对齐。
- 助手消息内容经 `DOMPurify.sanitize(marked.parse(content))` 处理后 `v-html` 渲染，防止 XSS；用户消息用纯文本 `{{ content }}`。
- 工具调用期间渲染 `el-tag` 标签列表。
- 流式加载动画：`status === "streaming"` 且 `content` 仍为空时，显示三个圆点的 `dot-flash` 关键帧动画（错峰延迟），**一旦首个 token 到达即隐藏**。

### 4. 输入框（`components/ChatInput.vue`）

- `el-input`（`type="textarea"` + `autosize`）绑定输入；监听 `keydown`：`Enter` 发送、`Shift+Enter` 换行。
- 发送按钮用 `:loading="disabled"` 表示请求进行中，输入为空或流式进行中时禁用。

### 5. 布局与滚动策略（`App.vue`）

- `el-container` 三段式布局：`el-header`（品牌 + 清空会话）、`el-main`（消息列表）、`el-footer`（输入框）。
- 滚动容器是普通 `<div>` 加 `@scroll="onScroll"`：每次滚动实时计算 `scrollHeight - scrollTop - clientHeight`，小于阈值 `NEAR_BOTTOM = 80` 即认为「在底部」并写入 `isAtBottom`。
- 消息变化时 `watch(messages, autoScroll, { deep: true })`，`autoScroll` 在 `nextTick` 后仅当 `isAtBottom` 为真才滚到底部——**用户向上翻阅时不打断**。
- 自定义滚动条：WebKit 用 `::-webkit-scrollbar-button { display: none }` 隐藏上下箭头、`::-webkit-scrollbar` 设 8px 细条；Firefox 用 `scrollbar-width: thin`。

### 6. 全局样式（`styles/main.scss`）

- 全局 `box-sizing` 重置 + 字体；`.chat-message__markdown` 提供 Markdown 排版样式（标题、列表、行内 `code`、`pre` 深色代码块、引用、表格、链接）。因 Markdown 是 `v-html` 注入的，其样式放在**非 scoped 的全局样式**中。

## 环境变量

在项目根目录 `.env` 中配置：

```bash
VITE_API_BASE=http://localhost:3000
```

`src/vite-env.d.ts` 中声明了 `ImportMetaEnv` 的 `VITE_API_BASE` 类型。

## 启动方式

1. 安装依赖（要求 pnpm 11）：

   ```bash
   pnpm install
   ```

2. 启动开发服务器（默认端口 5173）：

   ```bash
   pnpm dev
   ```

3. 构建（类型检查 + 打包）：

   ```bash
   pnpm build   # 等价于 vue-tsc --noEmit && vite build
   ```

   打开 http://localhost:5173，确保后端（`code-assistant-agent`）已在 3000 端口运行即可对话。
