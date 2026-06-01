<template>
  <span class="admin-removable-tag">
    <span><slot /></span>
    <button type="button" aria-label="Remove" @click="$emit('remove')">x</button>
  </span>
</template>

<script setup>
defineEmits(['remove'])
</script>

<style scoped>
.admin-removable-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.05);
  padding: 4px 8px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.82);
}

.admin-removable-tag button {
  border: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.58);
}
</style>
