<template>
  <span class="ui-tag-pill">
    <slot />
  </span>
</template>

<style scoped>
.ui-tag-pill {
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  padding: 3px 9px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.85);
}
</style>
