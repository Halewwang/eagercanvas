<template>
  <div :class="['admin-notice', `admin-notice-${variant}`]">
    <slot />
  </div>
</template>

<script setup>
defineProps({
  variant: {
    type: String,
    default: 'warning',
    validator: (value) => ['warning'].includes(value)
  }
})
</script>

<style scoped>
.admin-notice {
  border-radius: 14px;
  padding: 14px 16px;
  font-size: 13px;
  line-height: 1.6;
}

.admin-notice-warning {
  border: 1px solid rgba(255, 196, 0, 0.22);
  background: rgba(255, 196, 0, 0.08);
  color: rgba(255, 233, 169, 0.92);
}
</style>
