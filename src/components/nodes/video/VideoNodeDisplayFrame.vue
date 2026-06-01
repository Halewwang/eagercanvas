<template>
  <div class="module-video-shell">
    <div class="module-video-frame">
      <video
        v-if="isInteractive"
        :src="videoUrl"
        controls
        class="module-video"
      />
      <button
        v-else-if="showStaticPreview"
        class="module-video-static-preview"
        type="button"
        @click="$emit('activatePreview')"
      >
        <video
          :src="videoUrl"
          muted
          playsinline
          preload="metadata"
          class="module-video-static-media"
        />
        <span class="module-video-play-badge">
          <n-icon :size="18"><VideocamOutline /></n-icon>
        </span>
        <span class="module-video-static-label">Preview video</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { NIcon } from 'naive-ui'
import { VideocamOutline } from '@/icons/coolicons'

defineEmits(['activatePreview'])

const {
  isInteractive,
  showStaticPreview,
  videoUrl
} = defineProps({
  videoUrl: {
    type: String,
    default: ''
  },
  isInteractive: {
    type: Boolean,
    default: false
  },
  showStaticPreview: {
    type: Boolean,
    default: false
  }
})
</script>

<style scoped>
.module-video-shell {
  width: 100%;
  height: 100%;
  padding: var(--module-inset);
  background: #050505;
}
.module-video-frame {
  --inner-radius: calc(var(--module-radius) - var(--module-inset));
  width: 100%;
  height: 100%;
  border-radius: var(--inner-radius);
  overflow: hidden;
  background: #000;
}
.module-video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: var(--inner-radius);
  clip-path: inset(0 round var(--inner-radius));
  background: #000;
}
.module-video-static-preview {
  position: relative;
  width: 100%;
  height: 100%;
  border: 0;
  border-radius: var(--inner-radius);
  background: #000;
  color: #d8dbe0;
  display: block;
  padding: 0;
  overflow: hidden;
  cursor: pointer;
}
.module-video-static-media {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: var(--inner-radius);
  background: #000;
}
.module-video-play-badge {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 42px;
  height: 42px;
  transform: translate(-50%, -50%);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.48);
  border: 1px solid rgba(255, 255, 255, 0.45);
  color: #f4f4f5;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.module-video-static-label {
  position: absolute;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  padding: 4px 9px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.5);
  color: #f4f4f5;
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
  pointer-events: none;
}
</style>
