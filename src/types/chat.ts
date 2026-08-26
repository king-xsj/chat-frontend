export type MessageRole = "user" | "assistant";

export type MessageStatus = "streaming" | "done" | "error";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  activeTools: string[];
}

export interface StreamEvent {
  type: "token" | "tool_start" | "tool_end" | "done" | "error";
  content?: string;
  tool?: string;
  message?: string;
}
