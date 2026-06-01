<template>
  <div
    v-if="rect"
    class="capsule-menu group-capsule-menu"
    :style="{
      left: `${rect.left + rect.width / 2}px`,
      top: `${Math.max(20, rect.top - 54)}px`
    }"
  >
    <div class="capsule-inner capsule-inner-selected">
      <slot />
    </div>
  </div>
</template>

<script setup>
defineProps({
  rect: {
    type: Object,
    default: null
  }
})
</script>

<style scoped>
.group-capsule-menu {
  position: absolute;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  pointer-events: auto;
}

.group-capsule-menu .capsule-inner {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 7px 12px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(15, 15, 15, 0.96);
  backdrop-filter: blur(12px);
  box-shadow: 0 18px 32px rgba(0, 0, 0, 0.34);
  white-space: nowrap;
}

:deep(.capsule-group) {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

:deep(.capsule-icon) {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.02);
  color: #e7e8eb;
  transition: all 0.2s ease;
}

:deep(.capsule-icon:hover:not(:disabled)) {
  border-color: rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.08);
  color: #f3f4f6;
}

:deep(.capsule-icon-solid) {
  background: #0f0f0f;
  color: #f6f8fc;
  border-color: rgba(143, 143, 143, 0.65);
}

:deep(.capsule-create) {
  min-width: 86px;
  height: 28px;
  padding: 0 14px;
  gap: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
}

:deep(.capsule-create-label) {
  font-size: 12px;
  line-height: 1;
  font-weight: 500;
  white-space: nowrap;
}

:deep(.group-primary-btn) {
  min-width: 88px;
}

:deep(.group-danger-icon) {
  color: #d89b90;
  border-color: rgba(196, 106, 92, 0.24);
}

:deep(.group-danger-icon:hover:not(:disabled)) {
  color: #e5b0a8;
  border-color: rgba(196, 106, 92, 0.48);
  background: rgba(196, 106, 92, 0.1);
}
</style>
