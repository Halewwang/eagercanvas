<template>
  <label class="usage-check">
    <input :checked="checked" type="checkbox" @change="$emit('change', $event)" />
    <slot />
  </label>
</template>

<script setup>
defineEmits(['change'])

defineProps({
  checked: {
    type: Boolean,
    default: false
  }
})
</script>

<style scoped>
.usage-check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.035);
  padding: 7px 10px;
}
</style>
