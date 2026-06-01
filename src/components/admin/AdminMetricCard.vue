<template>
  <component :is="as" :class="cardClass">
    <p :class="labelClass">{{ label }}</p>
    <component :is="valueTag" :class="valueClass">{{ value }}</component>
    <p v-if="note" :class="noteClass">{{ note }}</p>
  </component>
</template>

<script setup>
defineProps({
  as: {
    type: String,
    default: 'article'
  },
  label: {
    type: String,
    required: true
  },
  value: {
    type: [String, Number],
    required: true
  },
  note: {
    type: String,
    default: ''
  },
  cardClass: {
    type: [String, Array, Object],
    default: ''
  },
  labelClass: {
    type: [String, Array, Object],
    default: 'admin-metric-label'
  },
  valueTag: {
    type: String,
    default: 'p'
  },
  valueClass: {
    type: [String, Array, Object],
    default: 'admin-metric-value'
  },
  noteClass: {
    type: [String, Array, Object],
    default: 'admin-metric-note'
  }
})
</script>

<style scoped>
.admin-metric-label {
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.4);
}

.admin-metric-value {
  margin-top: 12px;
  font-size: 30px;
  font-weight: 600;
  color: #fff;
}

.admin-metric-note {
  margin-top: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
}
</style>
