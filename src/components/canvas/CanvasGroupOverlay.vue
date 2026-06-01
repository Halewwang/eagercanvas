<template>
  <div class="group-overlay-layer">
    <CanvasGroupCreateMenu
      :rect="multiSelectMenuRect"
      @create-group="$emit('createGroup')"
    />

    <CanvasGroupBox
      v-for="group in renderedGroups"
      :key="group.id"
      :group="group"
      :selected="selectedGroupId === group.id"
      :hit-rects="groupBodyHitRectsById[group.id] || []"
      :pointer-events="groupBoxPointerEvents"
      @group-grip-pointer-down="$emit('groupGripPointerDown', group, $event)"
      @select-group="$emit('selectGroup', $event)"
    />

    <CanvasGroupActionsMenu
      :rect="selectedGroupMenuRect"
      @rename-group="$emit('renameGroup')"
      @duplicate-selected-group="$emit('duplicateSelectedGroup')"
      @ungroup-selected-group="$emit('ungroupSelectedGroup')"
      @delete-selected-group="$emit('deleteSelectedGroup')"
    />
  </div>
</template>

<script setup>
import CanvasGroupActionsMenu from './CanvasGroupActionsMenu.vue'
import CanvasGroupBox from './CanvasGroupBox.vue'
import CanvasGroupCreateMenu from './CanvasGroupCreateMenu.vue'

defineProps({
  multiSelectMenuRect: {
    type: Object,
    default: null
  },
  renderedGroups: {
    type: Array,
    default: () => []
  },
  selectedGroupId: {
    type: String,
    default: ''
  },
  selectedGroupMenuRect: {
    type: Object,
    default: null
  },
  groupBodyHitRectsById: {
    type: Object,
    default: () => ({})
  },
  groupBoxPointerEvents: {
    type: String,
    default: 'none'
  }
})

defineEmits([
  'createGroup',
  'groupGripPointerDown',
  'selectGroup',
  'renameGroup',
  'duplicateSelectedGroup',
  'ungroupSelectedGroup',
  'deleteSelectedGroup'
])
</script>

<style scoped>
.group-overlay-layer {
  position: absolute;
  inset: 0;
  z-index: 18;
  pointer-events: none;
}
</style>
