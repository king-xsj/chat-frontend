<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import { ChatDotRound, Delete } from "@element-plus/icons-vue";
import { useChat } from "./composables/useChat";
import ChatMessage from "./components/ChatMessage.vue";
import ChatInput from "./components/ChatInput.vue";

const { messages, streaming, send, clear } = useChat();
const listEl = ref<HTMLElement | null>(null);

// 距底部小于该阈值（px）视为「在底部」
const NEAR_BOTTOM = 10;
const isAtBottom = ref(true);

/**
 * 滚动事件处理：实时计算剩余未滚动高度，据此更新「是否在底部」标志。
 * scrollHeight - scrollTop - clientHeight 即为剩余未滚动内容高度，小于阈值视为在底部。
 */
function onScroll() {
  const el = listEl.value;
  if (!el) return;
  isAtBottom.value =
    el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM;
}

/**
 * 将消息列表滚动到底部。
 */
function scrollToBottom() {
  const el = listEl.value;
  if (el) el.scrollTop = el.scrollHeight;
}

/**
 * 内容变化后自动滚动：仅当用户原本就在底部时才跟随，避免打断向上翻阅。
 */
async function autoScroll() {
  await nextTick();
  if (isAtBottom.value) scrollToBottom();
}

// 内容变化（流式追加 token / 工具状态）时自动滚到底部
watch(messages, autoScroll, { deep: true });

/**
 * 发送消息：先滚动到底部，再走发送逻辑。
 */
function onSend(text: string) {
  scrollToBottom();
  send(text);
}
</script>

<template>
  <el-container class="app">
    <el-header class="app__header" height="56px">
      <div class="app__brand">
        <el-icon :size="22"><ChatDotRound /></el-icon>
        <span class="app__title">代码助手</span>
      </div>
      <el-button text :icon="Delete" @click="clear">清空会话</el-button>
    </el-header>

    <el-main class="app__main">
      <div ref="listEl" class="app__scroll" @scroll="onScroll">
        <div v-if="!messages.length" class="app__empty">
          <el-empty description="你好，我是你的代码助手，可以问我关于代码库的问题">
            <p class="app__empty-tip">
              也可以让我读写文件、运行类型检查与测试，回复会实时流式输出。
            </p>
          </el-empty>
        </div>
        <div v-else class="app__messages">
          <ChatMessage v-for="msg in messages" :key="msg.id" :message="msg" />
        </div>
      </div>
    </el-main>

    <el-footer class="app__footer" height="auto">
      <ChatInput :disabled="streaming" @send="onSend" />
    </el-footer>
  </el-container>
</template>

<style lang="scss" scoped>
.app {
  height: 100vh;
  max-width: 960px;
  margin: 0 auto;
  background: var(--el-bg-color-page);
  box-shadow: var(--el-box-shadow-light);

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--el-border-color-lighter);
    background: var(--el-bg-color);
  }

  &__brand {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--el-color-primary);
  }

  &__title {
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  &__main {
    padding: 0;
    overflow: hidden;
  }

  &__scroll {
    height: 100%;
    overflow-y: auto;
    padding: 20px; 
  }

  &__empty {
    padding-top: 80px;
  }

  &__empty-tip {
    color: var(--el-text-color-secondary);
    font-size: 13px;
    margin-top: 4px;
  }

  &__footer {
    padding: 0;
    border-top: 1px solid var(--el-border-color-lighter);
    background: var(--el-bg-color);
  }
}
</style>
