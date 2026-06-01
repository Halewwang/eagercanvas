<template>
  <component :is="tag" ref="surfaceRef" :class="surfaceClasses">
    <slot />
  </component>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  surfaceClass: {
    type: [String, Array, Object],
    default: ''
  },
  tag: {
    type: String,
    default: 'section'
  }
})

const surfaceRef = ref(null)
const surfaceClasses = computed(() => ['ui-glass-card', props.surfaceClass])

defineExpose({
  getSurfaceEl: () => surfaceRef.value
})
</script>

<style scoped>
.ui-glass-card {
  border: 1px solid rgba(255, 255, 255, 0.11);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.015) 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
}
</style>
