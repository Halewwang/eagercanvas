<template>
  <CanvasProjectRenameModal
    :show="showRename"
    :value="renameValue"
    @update:show="$emit('update:showRename', $event)"
    @update:value="$emit('update:renameValue', $event)"
    @confirm="$emit('confirmRename')"
  />

  <CanvasProjectDeleteModal
    :show="showDelete"
    :project-name="projectName"
    @update:show="$emit('update:showDelete', $event)"
    @confirm="$emit('confirmDelete')"
  />

  <CanvasGroupRenameModal
    :show="showGroupRename"
    :value="groupRenameValue"
    @update:show="$emit('update:showGroupRename', $event)"
    @update:value="$emit('update:groupRenameValue', $event)"
    @confirm="$emit('confirmRenameGroup')"
  />
</template>

<script setup>
import CanvasGroupRenameModal from './CanvasGroupRenameModal.vue'
import CanvasProjectDeleteModal from './CanvasProjectDeleteModal.vue'
import CanvasProjectRenameModal from './CanvasProjectRenameModal.vue'

defineProps({
  showRename: Boolean,
  showDelete: Boolean,
  showGroupRename: Boolean,
  renameValue: {
    type: String,
    default: ''
  },
  groupRenameValue: {
    type: String,
    default: ''
  },
  projectName: {
    type: String,
    default: ''
  }
})

defineEmits([
  'update:showRename',
  'update:showDelete',
  'update:showGroupRename',
  'update:renameValue',
  'update:groupRenameValue',
  'confirmRename',
  'confirmDelete',
  'confirmRenameGroup'
])
</script>
