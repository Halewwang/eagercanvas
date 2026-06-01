<template>
  <div
    class="canvas-group-box"
    :class="{ 'is-selected': selected }"
    :style="{
      left: `${group.rect.left}px`,
      top: `${group.rect.top}px`,
      width: `${group.rect.width}px`,
      height: `${group.rect.height}px`,
      pointerEvents: pointerEvents
    }"
  >
    <template v-if="selected">
      <div
        v-for="(hitRect, hitIndex) in hitRects"
        :key="`${group.id}-body-hit-${hitIndex}`"
        class="canvas-group-body-hit-zone"
        :style="{
          left: `${hitRect.left}px`,
          top: `${hitRect.top}px`,
          width: `${hitRect.width}px`,
          height: `${hitRect.height}px`
        }"
        @pointerdown="$emit('groupGripPointerDown', $event)"
        @mousedown="$emit('groupGripPointerDown', $event)"
        @click.stop="$emit('selectGroup', group.id)"
      />
    </template>
    <button
      class="canvas-group-title"
      :class="{ 'is-selected': selected }"
      @pointerdown="$emit('groupGripPointerDown', $event)"
      @mousedown="$emit('groupGripPointerDown', $event)"
      @click.stop="$emit('selectGroup', group.id)"
    >
      {{ group.name }}
    </button>
    <CanvasGroupEdge
      v-for="edge in groupEdges"
      :key="edge"
      :edge="edge"
      @group-grip-pointer-down="$emit('groupGripPointerDown', $event)"
      @select-group="$emit('selectGroup', group.id)"
    />
  </div>
</template>

<script setup>
import CanvasGroupEdge from './CanvasGroupEdge.vue'

const groupEdges = ['top', 'right', 'bottom', 'left']

defineProps({
  group: {
    type: Object,
    required: true
  },
  selected: {
    type: Boolean,
    default: false
  },
  hitRects: {
    type: Array,
    default: () => []
  },
  pointerEvents: {
    type: String,
    default: 'none'
  }
})

defineEmits(['groupGripPointerDown', 'selectGroup'])
</script>

<style scoped>
.canvas-group-box {
  position: absolute;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.045);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.02);
  pointer-events: none;
}

.canvas-group-box.is-selected {
  border-color: rgba(235, 226, 216, 0.82);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.03),
    0 0 0 1px rgba(165, 129, 99, 0.18);
}

.canvas-group-title {
  position: absolute;
  left: 0;
  top: -44px;
  z-index: 3;
  height: 32px;
  display: inline-flex;
  align-items: center;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(41, 41, 43, 0.96);
  color: #f3f4f6;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.2);
  pointer-events: auto;
  cursor: grab;
  user-select: none;
  touch-action: none;
}

.canvas-group-body-hit-zone {
  position: absolute;
  z-index: 1;
  background: transparent;
  pointer-events: auto;
  cursor: grab;
  user-select: none;
  touch-action: none;
}

.canvas-group-title.is-selected {
  border-color: rgba(255, 255, 255, 0.38);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.12);
}

</style>
