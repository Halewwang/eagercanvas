<template>
  <div class="admin-section-header">
    <div>
      <h2 class="admin-section-title">{{ title }}</h2>
      <p v-if="caption" class="admin-section-caption">{{ caption }}</p>
    </div>
    <slot name="actions" />
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true
  },
  caption: {
    type: String,
    default: ''
  }
})
</script>

<style scoped>
.admin-section-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.admin-section-title {
  font-size: 18px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
}

.admin-section-caption {
  margin-top: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.48);
}
</style>
