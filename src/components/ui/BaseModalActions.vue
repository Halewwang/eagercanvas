<template>
  <div class="ui-modal-actions">
    <slot />
  </div>
</template>

<style scoped>
.ui-modal-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
}
</style>
