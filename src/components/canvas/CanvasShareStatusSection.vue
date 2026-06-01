<template>
  <CanvasShareSection title="Status">
    <template #description>
      <p v-if="statusLoading">Loading current publish status...</p>
      <p v-else-if="published">
        Published to Featured Templates<span v-if="lastPublishedAt"> · Updated {{ new Date(lastPublishedAt).toLocaleString() }}</span>
      </p>
      <p v-else>Not published yet.</p>
    </template>
  </CanvasShareSection>
</template>

<script setup>
import CanvasShareSection from './CanvasShareSection.vue'

defineProps({
  statusLoading: Boolean,
  published: Boolean,
  lastPublishedAt: {
    type: String,
    default: ''
  }
})
</script>
