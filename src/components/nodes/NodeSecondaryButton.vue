<template>
  <button type="button" class="node-secondary-button">
    <slot />
  </button>
</template>

<style scoped>
.node-secondary-button {
  border: 1px solid rgba(143, 143, 143, 0.32);
  color: #8f939e;
  transition: border-color 0.2s ease, color 0.2s ease, opacity 0.2s ease;
}

.node-secondary-button:hover {
  border-color: rgba(226, 229, 235, 0.72);
  color: #f2f3f5;
}
</style>
