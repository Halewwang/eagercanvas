<template>
  <button type="button" class="canvas-toolbar-button" :class="{ 'canvas-toolbar-button--round': round }">
    <slot />
  </button>
</template>

<script setup>
defineProps({
  round: {
    type: Boolean,
    default: false
  }
})
</script>

<style scoped>
.canvas-toolbar-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 18px;
  border: 1px solid transparent;
  color: var(--text);
  background: transparent;
  outline: none;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, filter 0.2s ease, opacity 0.2s ease;
}

.canvas-toolbar-button:hover:not(:disabled) {
  background: var(--bg-tertiary);
}

.canvas-toolbar-button:focus,
.canvas-toolbar-button:focus-visible {
  outline: none;
  box-shadow: none;
}

.canvas-toolbar-button--round {
  border-radius: 999px;
}
</style>
