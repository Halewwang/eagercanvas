<template>
  <div class="group-overlay-layer">
    <CanvasGroupCreateMenu
      v-if="!readOnly"
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
      @group-grip-pointer-down="!readOnly && $emit('groupGripPointerDown', group, $event)"
      @select-group="!readOnly && $emit('selectGroup', $event)"
    />

    <CanvasGroupActionsMenu
      v-if="!readOnly"
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
  },
  readOnly: {
    type: Boolean,
    default: false
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
