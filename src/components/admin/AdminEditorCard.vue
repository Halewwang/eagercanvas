<template>
  <div class="admin-editor-card">
    <slot />
  </div>
</template>

<style scoped>
.admin-editor-card {
  display: flex;
  min-width: 220px;
  flex-direction: column;
  gap: 12px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  padding: 12px;
}
</style>
