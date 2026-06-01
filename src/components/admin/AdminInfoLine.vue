<template>
  <div class="ui-info-line">
    <span>{{ label }}</span>
    <strong :class="valueClass">
      <slot>{{ value }}</slot>
    </strong>
  </div>
</template>

<script setup>
defineProps({
  label: {
    type: String,
    required: true
  },
  value: {
    type: [Number, String],
    default: ''
  },
  valueClass: {
    type: String,
    default: ''
  }
})
</script>

<style scoped>
.ui-info-line {
  display: flex;
  justify-content: space-between;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.12);
  padding-bottom: 8px;
  color: rgba(255, 255, 255, 0.6);
}

.ui-info-line strong {
  color: rgba(255, 255, 255, 0.9);
}
</style>
