<template>
  <CanvasSyncConflictModal
    :show="showConflict"
    :action="conflictAction"
    @update:show="$emit('update:showConflict', $event)"
    @cancel="$emit('cancelConflict')"
    @save-copy="$emit('saveConflictCopy')"
    @refresh="$emit('refreshConflict')"
    @overwrite="$emit('overwriteConflict')"
  />

  <CanvasRemoteRefreshModal
    :show="showRemoteRefresh"
    :action="remoteRefreshAction"
    @update:show="$emit('update:showRemoteRefresh', $event)"
    @confirm="$emit('confirmRemoteRefresh')"
  />
</template>

<script setup>
import CanvasRemoteRefreshModal from './CanvasRemoteRefreshModal.vue'
import CanvasSyncConflictModal from './CanvasSyncConflictModal.vue'

defineProps({
  showConflict: Boolean,
  showRemoteRefresh: Boolean,
  conflictAction: {
    type: String,
    default: ''
  },
  remoteRefreshAction: {
    type: String,
    default: ''
  }
})

defineEmits([
  'update:showConflict',
  'update:showRemoteRefresh',
  'cancelConflict',
  'saveConflictCopy',
  'refreshConflict',
  'overwriteConflict',
  'confirmRemoteRefresh'
])
</script>
