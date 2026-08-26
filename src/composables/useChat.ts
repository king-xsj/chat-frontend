import { reactive, ref } from "vue";
import type { ChatMessage } from "../types/chat";
import { streamChat } from "../api/chat";

const SESSION_KEY = "chat-session-id";

/**
 * 生成唯一 ID。
 * crypto.randomUUID 仅在安全上下文（https / localhost）可用，其余环境降级为时间戳 + 随机数拼接。
 */
function makeId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * 获取会话 ID：优先从 localStorage 复用，不存在则生成并持久化。
 * 保证同一浏览器多次刷新仍沿用同一会话，后端据此维持多轮对话记忆。
 */
function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = makeId();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

/**
 * 聊天状态与逻辑的组合式函数（composable）。
 * 管理消息列表、流式输出状态、会话 ID，并提供 send / clear 两个动作。
 */
export function useChat() {
  const messages = ref<ChatMessage[]>([]);
  const streaming = ref(false);
  const sessionId = getSessionId();

  // 当前进行中请求的控制器，用于「清空会话」时中断流式请求
  let controller: AbortController | null = null;

  /**
   * 发送一条消息并流式接收助手回复。
   * 先追加用户消息，再创建 status 为 streaming 的助手消息，随后逐事件累积内容。
   */
  async function send(text: string) {
    const content = text.trim();
    if (!content || streaming.value) return;

    messages.value.push({
      id: makeId(),
      role: "user",
      content,
      status: "done",
      activeTools: [],
    });

    // 关键：用 reactive 包裹，后续对 assistant 的修改才能触发视图更新
    const assistant = reactive<ChatMessage>({
      id: makeId(),
      role: "assistant",
      content: "",
      status: "streaming",
      activeTools: [],
    });
    messages.value.push(assistant);
    streaming.value = true;

    const abortController = new AbortController();
    controller = abortController;

    try {
      await streamChat(content, sessionId, (event) => {
        switch (event.type) {
          case "token":
            assistant.content += event.content ?? "";
            break;
          case "tool_start":
            if (event.tool && !assistant.activeTools.includes(event.tool)) {
              assistant.activeTools.push(event.tool);
            }
            break;
          case "tool_end":
            assistant.activeTools = assistant.activeTools.filter(
              (t) => t !== event.tool
            );
            break;
          case "error":
            assistant.status = "error";
            if (event.message) {
              assistant.content += `\n\n[错误] ${event.message}`;
            }
            break;
          case "done":
            assistant.status = "done";
            break;
        }
      }, abortController.signal);
    } catch (err) {
      // 用户主动中断（清空会话）时静默退出，不当作错误显示
      if (abortController.signal.aborted) return;
      assistant.status = "error";
      assistant.content += `\n\n[请求失败] ${err instanceof Error ? err.message : String(err)}`;
    } finally {
      // 仅当仍是当前请求时才收尾，避免覆盖新请求的状态
      if (controller === abortController) {
        controller = null;
        if (assistant.status === "streaming") assistant.status = "done";
        streaming.value = false;
      }
    }
  }

  /**
   * 清空会话：中断进行中的流式请求，并重置消息列表与状态。
   */
  function clear() {
    controller?.abort();
    controller = null;
    messages.value = [];
    streaming.value = false;
  }

  return { messages, streaming, sessionId, send, clear };
}
