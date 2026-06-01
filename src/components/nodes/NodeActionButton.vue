<template>
  <button type="button" class="node-action-btn">
    <slot />
  </button>
</template>

<style scoped>
.node-action-btn {
  background: color-mix(in srgb, var(--bg-secondary) 88%, transparent);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  box-shadow: var(--panel-shadow);
  backdrop-filter: var(--surface-blur);
}
</style>
