<template>
  <div class="module-image-shell">
    <div class="module-image-frame">
      <img
        v-if="imageUrl"
        :src="imageUrl"
        :alt="alt"
        class="module-image"
        @load="$emit('image-load', $event)"
      />
      <div v-else class="module-image-preview-placeholder">
        <img src="../../../assets/loading.webp" alt="" class="w-10 h-9" />
        <span>Preparing preview...</span>
      </div>
      <ImageNodeCropOverlay
        v-if="cropActive"
        :mask-styles="cropMaskStyles"
        :box-style="cropBoxStyle"
        :handles="cropHandles"
        @drag-start="$emit('crop-drag-start', $event)"
        @resize-start="(handle, event) => $emit('crop-resize-start', handle, event)"
      />
    </div>
  </div>
</template>

<script setup>
import ImageNodeCropOverlay from './ImageNodeCropOverlay.vue'

defineProps({
  imageUrl: {
    type: String,
    default: ''
  },
  alt: {
    type: String,
    default: 'Image'
  },
  cropActive: {
    type: Boolean,
    default: false
  },
  cropMaskStyles: {
    type: Object,
    default: () => ({})
  },
  cropBoxStyle: {
    type: Object,
    default: () => ({})
  },
  cropHandles: {
    type: Array,
    default: () => []
  }
})

defineEmits(['image-load', 'crop-drag-start', 'crop-resize-start'])
</script>

<style scoped>
.module-image-shell {
  width: 100%;
  height: 100%;
  padding: var(--module-inset);
  background: #050505;
}

.module-image-frame {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: calc(var(--module-radius) - var(--module-inset));
}

.module-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: calc(var(--module-radius) - var(--module-inset));
}

.module-image-preview-placeholder {
  width: 100%;
  height: 100%;
  border-radius: calc(var(--module-radius) - var(--module-inset));
  background: #080808;
  color: #7b818c;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 12px;
}
</style>
