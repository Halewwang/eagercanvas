<template>
  <div class="upload-progress-wrap">
    <div class="upload-progress-track">
      <div class="upload-progress-bar" :style="progressStyle"></div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  progressStyle: {
    type: Object,
    default: () => ({})
  }
})
</script>

<style scoped>
.upload-progress-wrap {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 10px;
  z-index: 4;
  pointer-events: none;
}

.upload-progress-track {
  width: 100%;
  height: 3px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  overflow: hidden;
}

.upload-progress-bar {
  height: 100%;
  width: 0%;
  border-radius: inherit;
  transition: width 0.2s ease;
}
</style>
