<template>
  <div class="usage-surface">
    <slot />
  </div>
</template>

<style scoped>
.usage-surface {
  background: color-mix(in srgb, var(--bg-secondary) 84%, transparent);
  border: 1px solid var(--border-color);
  box-shadow: var(--panel-shadow);
  backdrop-filter: var(--surface-blur);
}
</style>
