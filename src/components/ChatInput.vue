<script setup lang="ts">
import { ref } from "vue";
import { Promotion } from "@element-plus/icons-vue";

const props = defineProps<{ disabled: boolean }>();
const emit = defineEmits<{ (e: "send", text: string): void }>();

const text = ref("");

/**
 * 提交输入：非空且非禁用时触发 send 事件，并清空输入框。
 */
function submit() {
  const value = text.value.trim();
  if (!value || props.disabled) return;
  emit("send", value);
  text.value = "";
}

/**
 * 键盘处理：Enter 发送，Shift+Enter 换行。
 */
function onKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    submit();
  }
}
</script>

<template>
  <div class="chat-input">
    <el-input
      v-model="text"
      class="chat-input__textarea"
      type="textarea"
      :autosize="{ minRows: 1, maxRows: 6 }"
      :disabled="disabled"
      resize="none"
      placeholder="输入你的问题…（Enter 发送，Shift+Enter 换行）"
      @keydown="onKeydown"
    />
    <el-button
      class="chat-input__send"
      type="primary"
      :icon="Promotion"
      :loading="disabled"
      :disabled="!text.trim()"
      @click="submit"
    >
      发送
    </el-button>
  </div>
</template>

<style lang="scss" scoped>
.chat-input {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 12px 16px;

  &__textarea {
    flex: 1;
  }

  &__send {
    flex-shrink: 0;
  }
}
</style>
