<template>
  <div class="w-full h-full bg-[#0f0f0f] flex flex-col items-center justify-center gap-4 relative text-center px-4">
    <div v-if="showPreviews" class="flex items-center gap-3">
      <div v-for="item in visiblePreviewItems" :key="item.key" class="flex flex-col items-center gap-1">
        <div class="w-16 h-16 rounded-lg overflow-hidden border border-[#2d2d2d] bg-black">
          <img :src="item.previewUrl" class="w-full h-full object-cover" />
        </div>
        <span class="text-[10px] text-[#7b818c]">{{ item.label }}</span>
      </div>
    </div>

    <div class="flex flex-col items-center gap-2">
      <n-icon :size="32" class="text-[#7b818c]"><VideocamOutline /></n-icon>
      <span class="text-sm text-[#7b818c]">{{ connectHint }}</span>
      <button class="upload-btn" @click="$emit('upload')">Upload</button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { NIcon } from 'naive-ui'
import { VideocamOutline } from '@/icons/coolicons'

defineEmits(['upload'])

const {
  connectHint,
  items,
  showPreviews
} = defineProps({
  showPreviews: {
    type: Boolean,
    default: false
  },
  items: {
    type: Array,
    default: () => []
  },
  connectHint: {
    type: String,
    default: ''
  }
})

const visiblePreviewItems = computed(() => items.filter((item) => item.active && item.previewUrl))
</script>
