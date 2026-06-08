<template>
  <div class="module-progress-shell">
    <div class="module-progress-track"></div>
    <div class="module-progress-bar" :style="barStyle"></div>
    <div class="module-progress-label">{{ label }} - {{ percent }}% - {{ elapsedSeconds }}s</div>
  </div>
</template>

<script setup>
defineProps({
  barStyle: {
    type: Object,
    default: () => ({})
  },
  percent: {
    type: Number,
    default: 0
  },
  label: {
    type: String,
    default: 'Generating image'
  },
  elapsedSeconds: {
    type: Number,
    default: 0
  }
})
</script>

<style scoped>
.module-progress-shell {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  background: #101010;
}

.module-progress-track {
  position: absolute;
  inset: 0;
  background: transparent;
}

.module-progress-bar {
  position: absolute;
  inset: 0 auto 0 0;
  width: 0%;
  background: #2d2d2d;
  transition: width 0.12s linear;
}

.module-progress-label {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 10px;
  color: rgba(247, 249, 252, 0.9);
  font-size: 12px;
  line-height: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
