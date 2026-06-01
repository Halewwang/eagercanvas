<template>
  <div v-if="error" class="text-xs text-red-500 mt-2">
    {{ error.message || 'Generation failed' }}
  </div>
</template>

<script setup>
defineProps({
  error: {
    type: Object,
    default: null
  }
})
</script>
