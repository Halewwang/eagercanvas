<template>
  <n-modal :show="show" :mask-closable="true" @update:show="$emit('update:show', $event)">
    <div class="zoom-modal-card" @click.stop>
      <video :src="videoUrl" controls autoplay class="zoom-video-original" />
    </div>
  </n-modal>
</template>

<script setup>
import { NModal } from 'naive-ui'

defineProps({
  show: Boolean,
  videoUrl: {
    type: String,
    default: ''
  }
})

defineEmits(['update:show'])
</script>

<style scoped>
.zoom-modal-card {
  max-width: calc(100vw - 80px);
  max-height: calc(100vh - 80px);
  overflow: auto;
  border: 1px solid rgba(143, 143, 143, 0.38);
  border-radius: 14px;
  background: #121212;
  padding: 12px;
}

.zoom-video-original {
  display: block;
  width: auto;
  max-width: min(1200px, calc(100vw - 140px));
  height: auto;
  max-height: calc(100vh - 140px);
  background: #000;
}
</style>
