<script setup lang="ts">
import { computed } from "vue";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { User, Monitor } from "@element-plus/icons-vue";
import type { ChatMessage } from "../types/chat";

const props = defineProps<{ message: ChatMessage }>();

/**
 * 将助手消息的 Markdown 渲染为安全 HTML。
 * 先用 marked 解析，再经 DOMPurify 消毒，防止 XSS 注入。
 */
const renderedHtml = computed(() =>
  DOMPurify.sanitize(marked.parse(props.message.content, { async: false }) as string)
);
</script>

<template>
  <div
    class="chat-message"
    :class="[
      `chat-message--${message.role}`,
      { 'chat-message--loading': message.status === 'streaming' && !message.content },
    ]"
  >
    <el-avatar
      v-if="message.role === 'assistant'"
      class="chat-message__avatar"
      :size="36"
      :icon="Monitor"
    />
    <div class="chat-message__body">
      <div
        v-if="message.activeTools.length"
        class="chat-message__tools"
      >
        <el-tag
          v-for="tool in message.activeTools"
          :key="tool"
          size="small"
          type="info"
          effect="plain"
        >
          🔧 {{ tool }}
        </el-tag>
      </div>

      <div v-if="message.content" class="chat-message__bubble">
        <div
          v-if="message.role === 'assistant'"
          class="chat-message__markdown"
          v-html="renderedHtml"
        ></div>
        <div v-else class="chat-message__text">{{ message.content }}</div>
      </div>
      <span
        v-if="message.status === 'streaming' && !message.content"
        class="chat-message__loading"
      >
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      </span>
    </div>
    <el-avatar
      v-if="message.role === 'user'"
      class="chat-message__avatar"
      :size="36"
      :icon="User"
    />
  </div>
</template>

<style lang="scss" scoped>
.chat-message {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 20px;

  // 流式加载中（尚未有内容）时，头像与跳动圆点垂直居中
  &--loading {
    align-items: center;
  }

  &--user {
    justify-content: flex-end;
  }

  &__avatar {
    flex-shrink: 0;
    background: var(--el-color-primary);
    color: #fff;
  }

  &--user &__avatar {
    background: var(--el-color-success);
  }

  &__body {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    max-width: calc(100% - 60px);
  }

  &--user &__body {
    align-items: flex-end;
  }

  &__tools {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 6px;
  }

  &__bubble {
    padding: 8px;
    border-radius: 10px;
    word-break: break-word;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    color: var(--el-text-color-primary);
  }

  &--user &__bubble {
    background: var(--el-color-primary);
    border-color: var(--el-color-primary);
    color: #fff;
  }

  &__text {
    white-space: pre-wrap;
  }

  &__loading {
    display: flex;
    gap: 4px;
    .dot{
      width: 6px;
      height: 6px;
      // margin-left: 8px;
      border-radius: 50%;
      background-color: var(--el-color-primary);
      animation: dot-flash 1.4s infinite ease-in-out;
      &:nth-child(1) {
        animation-delay: -0.32s;
      }

      &:nth-child(2) {
        animation-delay: -0.16s;
      }
    }
    
   
  }
}

@keyframes dot-flash {
  0%, 80%, 100% {
    transform: scale(0);
    opacity: 0.3;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

</style>
