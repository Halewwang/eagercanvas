<template>
  <div
    class="w-full h-full bg-[#0f0f0f] flex flex-col items-center justify-center gap-2 relative text-center px-4 nodrag nopan"
    @mousedown.stop
  >
    <n-icon :size="32" class="text-[#7b818c]"><ImageOutline /></n-icon>
    <span class="text-sm text-[#7b818c]">Drop an image or click to upload</span>
    <button class="upload-btn nodrag nopan" @click.stop="$emit('upload')">Upload</button>
  </div>
</template>

<script setup>
import { NIcon } from 'naive-ui'
import { ImageOutline } from '@/icons/coolicons'

defineEmits(['upload'])
</script>

<style scoped>
.upload-btn {
  margin-top: 4px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.04);
  color: #d7dbe3;
  border-radius: 999px;
  font-size: 12px;
  padding: 6px 12px;
  line-height: 1;
}
</style>
