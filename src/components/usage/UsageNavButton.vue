<template>
  <button type="button" class="usage-nav-button">
    <slot />
  </button>
</template>

<style scoped>
.usage-nav-button {
  background: color-mix(in srgb, var(--bg-secondary) 80%, transparent);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  transition: border-color 0.2s ease, transform 0.2s ease;
}

.usage-nav-button:hover {
  border-color: color-mix(in srgb, #ffffff 28%, var(--border-color));
  transform: translateY(-1px);
}
</style>
