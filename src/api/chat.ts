import type { StreamEvent } from "../types/chat";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000";

/**
 * 以流式方式调用后端 /api/chat/stream，逐行解析 NDJSON 事件并回调。
 * 向后端发起一个 NDJSON 流式 POST 请求，用 ReadableStream + TextDecoder + 换行切分的方式，把每个分块里的完整行逐条 JSON.parse 后通过 onEvent 回调出去，并正确处理了「跨块半行」和「中文多字节截断」两种情况。
 * @param message   用户消息内容
 * @param sessionId 会话 ID（后端据此维持多轮记忆）
 * @param onEvent   每解析出一条事件时回调（token / tool_start / tool_end / done / error）
 * @param signal    可选的 AbortSignal，用于中断请求（如「清空会话」）
 */
export async function streamChat(
  message: string,
  sessionId: string,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, sessionId }),
    signal,
  });
  /**
   * res.ok 为 false（HTTP 状态码非 2xx）时，读取响应文本作为错误详情（.catch 防止读文本本身也失败），然后抛出带状态码和错误信息的异常。
   若 res.body 为空，说明浏览器不返回流式 body，直接抛错。
   */
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`请求失败（${res.status}）：${text || res.statusText}`);
  }
  if (!res.body) {
    throw new Error("响应不支持流式读取");
  }

  const reader = res.body.getReader(); // 拿到可读流的读取器，逐块读取数据。
  const decoder = new TextDecoder(); // 把字节（Uint8Array）解码成字符串。
  let buffer = ""; // 缓冲区，用来暂存跨块被截断的半行数据（关键，见下面循环）。

  while (true) {
    const { value, done } = await reader.read(); // 读取一块数据。
    if (done) break; // 读取器读完流时退出循环。

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    // 最后一段（没有换行符结尾）可能只是半行，把它重新放回缓冲区，等下一块数据补齐后再处理。
    buffer = lines.pop() ?? ""; 

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        onEvent(JSON.parse(trimmed) as StreamEvent);
      } catch {
        // 忽略无法解析的行
      }
    }
  }

  // 处理末尾可能残留的半行
  if (buffer.trim()) {
    try {
      onEvent(JSON.parse(buffer.trim()) as StreamEvent);
    } catch {
      // ignore
    }
  }
}
