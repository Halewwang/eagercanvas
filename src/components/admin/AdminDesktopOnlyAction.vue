<template>
  <div class="admin-desktop-only-action">
    <slot v-if="desktopEnabled" :desktop-enabled="desktopEnabled" :disabled="!desktopEnabled" />
    <button v-else type="button" class="admin-desktop-only-button" :disabled="!desktopEnabled">
      请使用桌面端完成此操作
    </button>
    <p v-if="!desktopEnabled" class="admin-desktop-only-note">移动端只读，管理操作需要宽度至少 768px。</p>
  </div>
</template>

<script setup>
defineProps({
  desktopEnabled: { type: Boolean, default: false }
})
</script>

<style scoped>
.admin-desktop-only-action {
  display: grid;
  justify-items: end;
  gap: 4px;
}

.admin-desktop-only-note {
  max-width: 280px;
  color: rgb(255 255 255 / 45%);
  font-size: 11px;
  line-height: 1.45;
  text-align: right;
}

.admin-desktop-only-button {
  min-height: 32px;
  border: 1px solid rgb(255 255 255 / 10%);
  border-radius: 8px;
  padding: 8px 12px;
  color: rgb(255 255 255 / 50%);
  font-size: 12px;
}

@media (min-width: 768px) {
  .admin-desktop-only-action {
    justify-items: stretch;
  }
}
</style>
