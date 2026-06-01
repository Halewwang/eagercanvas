<template>
  <button type="button" class="config-node-inline-action-button">
    <slot />
  </button>
</template>

<style scoped>
.config-node-inline-action-button {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: #8f939e;
  font: inherit;
  font-size: 0.75rem;
  line-height: 1rem;
  transition: color 0.2s ease;
}

.config-node-inline-action-button:hover {
  color: #f2f3f5;
}
</style>
