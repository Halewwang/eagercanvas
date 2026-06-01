<template>
  <div class="upload-progress-wrap" :style="moduleStyle">
    <div class="upload-progress-track">
      <div class="upload-progress-bar" :style="progressStyle"></div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  moduleStyle: {
    type: Object,
    default: () => ({})
  },
  progressStyle: {
    type: Object,
    default: () => ({})
  }
})
</script>

<style scoped>
.upload-progress-wrap {
  width: 100%;
  display: flex;
  justify-content: center;
  margin-top: 12px;
}

.upload-progress-track {
  width: 100%;
  height: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
}

.upload-progress-bar {
  width: 0%;
  height: 100%;
  border-radius: inherit;
  transition: width 0.2s ease, background 0.2s ease;
}
</style>
