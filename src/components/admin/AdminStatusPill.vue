<template>
  <span class="ui-status-pill" :class="className">
    <slot />
  </span>
</template>

<script setup>
defineProps({
  className: {
    type: [String, Array, Object],
    default: ''
  }
})
</script>

<style scoped>
.ui-status-pill {
  border-radius: 999px;
  border: 1px solid transparent;
  padding: 4px 10px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.ui-status-pill-active {
  border-color: rgba(255, 255, 255, 0.35);
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.95);
}

.ui-status-pill-suspended {
  border-color: rgba(180, 180, 180, 0.4);
  background: rgba(180, 180, 180, 0.16);
  color: rgba(232, 232, 232, 0.95);
}

.ui-status-pill-deleted {
  border-color: rgba(110, 110, 110, 0.48);
  background: rgba(110, 110, 110, 0.18);
  color: rgba(210, 210, 210, 0.92);
}
</style>
