<template>
  <span
    class="inline-block animate-spin rounded-full border-2 border-white/20 border-t-current"
    :style="spinnerStyle"
    aria-hidden="true"
  />
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  size: {
    type: Number,
    default: 16
  }
})

const spinnerStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`
}))
</script>
