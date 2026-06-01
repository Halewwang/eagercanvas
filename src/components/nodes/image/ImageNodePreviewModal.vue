<template>
  <n-modal :show="show" :mask-closable="true" @update:show="$emit('update:show', $event)">
    <div class="zoom-modal-card" @click.stop>
      <div class="zoom-modal-toolbar">
        <div class="zoom-modal-actions">
          <button class="zoom-tool-btn zoom-tool-btn-download" @click="$emit('download')">
            <n-icon :size="14"><DownloadOutline /></n-icon>
            <span>Download</span>
          </button>
        </div>
        <div class="zoom-modal-actions">
          <button class="zoom-tool-btn" :disabled="previewZoom <= minZoom" @click="$emit('zoom-out')">-</button>
          <button class="zoom-tool-btn" @click="$emit('reset-zoom')">Fit</button>
          <button class="zoom-tool-btn" :disabled="previewZoom >= maxZoom" @click="$emit('zoom-in')">+</button>
          <div class="zoom-modal-divider" />
          <div class="zoom-modal-chip">{{ Math.round(previewZoom * 100) }}%</div>
        </div>
      </div>
      <div ref="stageRef" class="zoom-modal-stage">
        <div class="zoom-stage-canvas" :style="canvasStyle">
          <div class="zoom-image-wrap" :style="imageStyle">
            <img
              :src="imageUrl"
              alt="Preview"
              class="zoom-image-original"
              @load="$emit('image-load', $event)"
            />
          </div>
        </div>
      </div>
    </div>
  </n-modal>
</template>

<script setup>
import { ref } from 'vue'
import { NIcon, NModal } from 'naive-ui'
import { DownloadOutline } from '@/icons/coolicons'

defineProps({
  show: {
    type: Boolean,
    default: false
  },
  imageUrl: {
    type: String,
    default: ''
  },
  previewZoom: {
    type: Number,
    default: 1
  },
  minZoom: {
    type: Number,
    default: 0.75
  },
  maxZoom: {
    type: Number,
    default: 4
  },
  canvasStyle: {
    type: Object,
    default: () => ({})
  },
  imageStyle: {
    type: Object,
    default: () => ({})
  }
})

defineEmits(['update:show', 'download', 'zoom-out', 'reset-zoom', 'zoom-in', 'image-load'])

const stageRef = ref(null)
const getStageElement = () => stageRef.value

defineExpose({
  getStageElement
})
</script>

<style scoped>
.zoom-modal-card {
  width: min(1400px, calc(100vw - 80px));
  height: min(960px, calc(100vh - 80px));
  max-width: calc(100vw - 80px);
  max-height: calc(100vh - 80px);
  overflow: hidden;
  background: #121212;
  border: 1px solid rgba(143, 143, 143, 0.38);
  border-radius: 14px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.zoom-modal-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.zoom-modal-chip {
  display: inline-flex;
  align-items: center;
  min-width: 58px;
  height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.04);
  color: #f3f4f6;
  font-size: 12px;
}

.zoom-modal-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.zoom-modal-divider {
  width: 1px;
  height: 22px;
  background: rgba(255, 255, 255, 0.14);
}

.zoom-tool-btn {
  min-width: 38px;
  height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.04);
  color: #f3f4f6;
  font-size: 12px;
  transition: background 0.18s ease, border-color 0.18s ease, opacity 0.18s ease;
}

.zoom-tool-btn-download {
  gap: 8px;
  padding: 0 14px;
}

.zoom-tool-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.28);
}

.zoom-tool-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.zoom-tool-btn-primary {
  background: linear-gradient(180deg, #ece7e2 0%, #d5cdc5 100%);
  color: #111111;
  border-color: rgba(213, 205, 197, 0.92);
}

.zoom-tool-btn-primary:hover:not(:disabled) {
  background: linear-gradient(180deg, #f2eeea 0%, #ddd5ce 100%);
  border-color: rgba(221, 213, 206, 0.96);
}

.zoom-modal-stage {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border-radius: 12px;
  background:
    linear-gradient(0deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.02)),
    linear-gradient(45deg, #171717 25%, transparent 25%, transparent 75%, #171717 75%, #171717),
    linear-gradient(45deg, #171717 25%, #0f0f0f 25%, #0f0f0f 75%, #171717 75%, #171717);
  background-size: auto, 24px 24px, 24px 24px;
  background-position: 0 0, 0 0, 12px 12px;
  padding: 20px;
}

.zoom-stage-canvas {
  display: grid;
  place-items: center;
}

.zoom-image-wrap {
  position: relative;
  width: max-content;
  height: max-content;
}

.zoom-image-original {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 12px;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.4);
}
</style>
