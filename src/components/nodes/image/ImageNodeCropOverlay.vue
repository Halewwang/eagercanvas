<template>
  <div class="crop-overlay crop-overlay-inline">
    <div class="crop-mask crop-mask-top" :style="maskStyles.top"></div>
    <div class="crop-mask crop-mask-left" :style="maskStyles.left"></div>
    <div class="crop-mask crop-mask-right" :style="maskStyles.right"></div>
    <div class="crop-mask crop-mask-bottom" :style="maskStyles.bottom"></div>
    <div class="crop-box" :style="boxStyle" @mousedown.stop.prevent="$emit('drag-start', $event)">
      <span
        v-for="handle in handles"
        :key="handle"
        class="crop-handle"
        :class="`crop-handle-${handle}`"
        @mousedown.stop.prevent="$emit('resize-start', handle, $event)"
      />
    </div>
    <div class="crop-inline-tip">Enter apply · Esc cancel</div>
  </div>
</template>

<script setup>
defineProps({
  maskStyles: {
    type: Object,
    default: () => ({
      top: {},
      left: {},
      right: {},
      bottom: {}
    })
  },
  boxStyle: {
    type: Object,
    default: () => ({})
  },
  handles: {
    type: Array,
    default: () => []
  }
})

defineEmits(['drag-start', 'resize-start'])
</script>

<style scoped>
.crop-overlay {
  position: absolute;
  inset: 0;
}

.crop-overlay-inline {
  border-radius: inherit;
  overflow: hidden;
}

.crop-mask {
  position: absolute;
  background: rgba(0, 0, 0, 0.48);
  pointer-events: none;
}

.crop-box {
  position: absolute;
  border: 2px solid rgba(255, 255, 255, 0.92);
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.14);
  cursor: move;
}

.crop-box::before,
.crop-box::after {
  content: '';
  position: absolute;
  background: rgba(255, 255, 255, 0.26);
}

.crop-box::before {
  left: 33.333%;
  top: 0;
  width: 1px;
  height: 100%;
  box-shadow: calc(33.333% + 1px) 0 0 rgba(255, 255, 255, 0.26);
}

.crop-box::after {
  top: 33.333%;
  left: 0;
  width: 100%;
  height: 1px;
  box-shadow: 0 calc(33.333% + 1px) 0 rgba(255, 255, 255, 0.26);
}

.crop-handle {
  position: absolute;
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: #f3f4f6;
  border: 2px solid #111111;
}

.crop-handle-nw {
  left: -7px;
  top: -7px;
  cursor: nwse-resize;
}

.crop-handle-ne {
  right: -7px;
  top: -7px;
  cursor: nesw-resize;
}

.crop-handle-sw {
  left: -7px;
  bottom: -7px;
  cursor: nesw-resize;
}

.crop-handle-se {
  right: -7px;
  bottom: -7px;
  cursor: nwse-resize;
}

.crop-inline-tip {
  position: absolute;
  right: 12px;
  bottom: 12px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(18, 18, 18, 0.74);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #f3f4f6;
  font-size: 11px;
  letter-spacing: 0.02em;
  pointer-events: none;
}
</style>
