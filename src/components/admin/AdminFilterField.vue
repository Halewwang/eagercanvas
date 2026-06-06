<template>
  <label class="admin-filter-field">
    <span class="admin-filter-label">{{ label }}</span>
    <slot />
  </label>
</template>

<script setup>
defineProps({
  label: {
    type: String,
    required: true
  }
})
</script>

<style scoped>
.admin-filter-field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
}

.admin-filter-label {
  color: rgb(255 255 255 / 45%);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  line-height: 1;
  text-transform: uppercase;
}
</style>
