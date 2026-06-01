<template>
  <component :is="tag" :class="surfaceClasses">
    <slot />
  </component>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  tag: {
    type: String,
    default: 'section'
  },
  surfaceClass: {
    type: [String, Array, Object],
    default: ''
  }
})

const surfaceClasses = computed(() => ['usage-card', props.surfaceClass])
</script>

<style scoped>
.usage-card {
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.026));
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.22);
}
</style>
