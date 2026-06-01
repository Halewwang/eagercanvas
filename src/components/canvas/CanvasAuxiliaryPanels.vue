<template>
  <ApiSettings
    :show="showApiSettings"
    @update:show="$emit('update:showApiSettings', $event)"
  />

  <MediaLibraryPanel
    :show="showMediaLibrary"
    :project-id="projectId"
    @update:show="$emit('update:showMediaLibrary', $event)"
    @insert-asset="$emit('insertAsset', $event)"
  />
</template>

<script setup>
import ApiSettings from '@/components/ApiSettings.vue'
import MediaLibraryPanel from '@/components/MediaLibraryPanel.vue'

defineProps({
  showApiSettings: {
    type: Boolean,
    default: false
  },
  showMediaLibrary: {
    type: Boolean,
    default: false
  },
  projectId: {
    type: String,
    default: ''
  }
})

defineEmits([
  'update:showApiSettings',
  'update:showMediaLibrary',
  'insertAsset'
])
</script>
