<template>
  <button type="button" class="canvas-pill-button" :class="{ 'canvas-pill-button--compact': compact }">
    <slot />
  </button>
</template>

<script setup>
defineProps({
  compact: {
    type: Boolean,
    default: false
  }
})
</script>

<style scoped>
.canvas-pill-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 36px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid transparent;
  color: var(--text);
  background: transparent;
  outline: none;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, opacity 0.2s ease;
}

.canvas-pill-button:hover {
  background: var(--bg-tertiary);
}

.canvas-pill-button:focus,
.canvas-pill-button:focus-visible {
  outline: none;
  box-shadow: none;
}

.canvas-pill-button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.canvas-pill-button--compact {
  padding: 0 12px;
}
</style>
