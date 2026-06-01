<template>
  <span class="admin-permission-chip">{{ label }}</span>
</template>

<script setup>
defineProps({
  label: {
    type: String,
    default: ''
  }
})
</script>

<style scoped>
.admin-permission-chip {
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.05);
  padding: 5px 10px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.76);
}
</style>
