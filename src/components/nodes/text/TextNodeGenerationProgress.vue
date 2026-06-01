<template>
  <div class="module-progress-shell rounded-[14px]">
    <div class="module-progress-track"></div>
    <div class="module-progress-bar" :style="barStyle"></div>
    <div class="module-progress-label">Generating text... {{ percent }}%</div>
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
  }
})
</script>

<style scoped>
.module-progress-shell {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #151515;
}

.module-progress-track {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02));
}

.module-progress-bar {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 4px;
  background: linear-gradient(90deg, #7c6cff, #58d8ff);
  transition: width 0.18s ease;
}

.module-progress-label {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #dfe3ec;
  font-size: 13px;
}
</style>
