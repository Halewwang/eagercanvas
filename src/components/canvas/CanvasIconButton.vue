<template>
  <button type="button" class="canvas-icon-button">
    <slot />
  </button>
</template>

<style scoped>
.canvas-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 1px solid transparent;
  color: var(--text);
  background: transparent;
  outline: none;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, opacity 0.2s ease;
}

.canvas-icon-button:hover:not(:disabled) {
  background: var(--bg-tertiary);
}

.canvas-icon-button:focus,
.canvas-icon-button:focus-visible {
  outline: none;
  box-shadow: none;
}

.canvas-icon-button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
</style>
