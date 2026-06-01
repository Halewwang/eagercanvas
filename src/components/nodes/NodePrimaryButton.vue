<template>
  <button type="button" class="node-primary-button">
    <slot />
  </button>
</template>

<style scoped>
.node-primary-button {
  background: linear-gradient(135deg, var(--button-highlight), var(--button-highlight-hover));
  color: #090b0d;
  border: 1px solid color-mix(in srgb, var(--button-highlight) 80%, #000000 20%);
  transition: transform 0.2s ease, opacity 0.2s ease, filter 0.2s ease;
}

.node-primary-button:hover {
  filter: brightness(1.04);
  transform: translateY(-1px);
}
</style>
