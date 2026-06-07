<template>
  <div class="group-overlay-layer">
    <CanvasGroupCreateMenu
      v-if="!readOnly"
      :rect="multiSelectMenuRect"
      @create-group="$emit('createGroup')"
    />

    <CanvasGroupOutputLines
      :lines="visibleGroupOutputLines"
      :selected-line-id="selectedGroupOutputLinkId"
      :selectable="!readOnly"
      @select-line="$emit('selectGroupOutputLine', $event)"
    />

    <CanvasGroupBox
      v-for="group in renderedGroups"
      :key="group.id"
      :group="group"
      :selected="selectedGroupId === group.id"
      :merge-candidate="groupMergeCandidateId === group.id"
      :hit-rects="groupBodyHitRectsById[group.id] || []"
      :pointer-events="groupBoxPointerEvents"
      @group-grip-pointer-down="!readOnly && $emit('groupGripPointerDown', group, $event)"
      @select-group="!readOnly && $emit('selectGroup', $event)"
      @group-output-pointer-down="!readOnly && $emit('groupOutputPointerDown', group, $event)"
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
import { computed } from 'vue'
import CanvasGroupActionsMenu from './CanvasGroupActionsMenu.vue'
import CanvasGroupBox from './CanvasGroupBox.vue'
import CanvasGroupCreateMenu from './CanvasGroupCreateMenu.vue'
import CanvasGroupOutputLines from './CanvasGroupOutputLines.vue'

const props = defineProps({
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
  groupOutputLines: {
    type: Array,
    default: () => []
  },
  pendingGroupOutputLine: {
    type: Object,
    default: null
  },
  selectedGroupOutputLinkId: {
    type: String,
    default: ''
  },
  viewportZoom: {
    type: Number,
    default: 1
  },
  viewport: {
    type: Object,
    default: () => ({})
  },
  groupMergeCandidateId: {
    type: String,
    default: ''
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

const getFlowPoint = (point = {}) => {
  const zoom = Math.max(Number(props.viewport?.zoom) || Number(props.viewportZoom) || 1, 0.01)
  const viewportX = Number(props.viewport?.x) || 0
  const viewportY = Number(props.viewport?.y) || 0
  return {
    x: (Number(point?.x) - viewportX) / zoom,
    y: (Number(point?.y) - viewportY) / zoom
  }
}

const toFlowLine = (line = {}) => ({
  ...line,
  source: getFlowPoint(line.source),
  target: getFlowPoint(line.target)
})

const visibleGroupOutputLines = computed(() => (
  props.pendingGroupOutputLine
    ? [...props.groupOutputLines, props.pendingGroupOutputLine].map(toFlowLine)
    : props.groupOutputLines.map(toFlowLine)
))

defineEmits([
  'createGroup',
  'selectGroupOutputLine',
  'groupOutputPointerDown',
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
