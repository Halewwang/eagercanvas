<template>
  <CanvasShareSection title="Workspace">
    <template #description>
      <p>{{ workspaceName }}</p>
    </template>
  </CanvasShareSection>
</template>

<script setup>
import CanvasShareSection from './CanvasShareSection.vue'

defineProps({
  workspaceName: {
    type: String,
    default: ''
  }
})
</script>
