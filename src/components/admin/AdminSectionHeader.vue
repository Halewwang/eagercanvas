<template>
  <div class="admin-section-header">
    <div>
      <h2 class="admin-section-title">{{ title }}</h2>
      <p v-if="caption" class="admin-section-caption">{{ caption }}</p>
    </div>
    <div v-if="$slots.actions" class="admin-section-actions">
      <slot name="actions" />
    </div>
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
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.admin-section-header > div:first-child {
  min-width: 0;
  flex: 1 1 280px;
}

.admin-section-actions {
  display: flex;
  flex: 0 1 auto;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  max-width: 100%;
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

@media (max-width: 640px) {
  .admin-section-header {
    align-items: stretch;
  }

  .admin-section-actions {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
