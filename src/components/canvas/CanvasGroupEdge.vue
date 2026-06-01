<template>
  <button
    class="canvas-group-edge"
    :class="edge"
    @pointerdown="$emit('groupGripPointerDown', $event)"
    @mousedown="$emit('groupGripPointerDown', $event)"
    @click.stop="$emit('selectGroup')"
  />
</template>

<script setup>
defineProps({
  edge: {
    type: String,
    required: true
  }
})

defineEmits(['groupGripPointerDown', 'selectGroup'])
</script>

<style scoped>
.canvas-group-edge {
  position: absolute;
  z-index: 2;
  border: none;
  background: transparent;
  pointer-events: auto;
  cursor: grab;
}

.canvas-group-edge::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
}

.canvas-group-edge.top,
.canvas-group-edge.bottom {
  left: 0;
  width: 100%;
  height: 14px;
}

.canvas-group-edge.left,
.canvas-group-edge.right {
  top: 0;
  width: 14px;
  height: 100%;
}

.canvas-group-edge.top {
  top: 0;
}

.canvas-group-edge.top::before,
.canvas-group-edge.bottom::before {
  border-left: none;
  border-right: none;
}

.canvas-group-edge.bottom {
  bottom: 0;
}

.canvas-group-edge.left {
  left: 0;
}

.canvas-group-edge.left::before,
.canvas-group-edge.right::before {
  border-top: none;
  border-bottom: none;
}

.canvas-group-edge.right {
  right: 0;
}
</style>
