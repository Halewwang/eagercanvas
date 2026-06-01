<template>
  <div v-show="visible" :class="['absolute -top-5 z-[1000]', positionClass]">
    <NodeActionButton
      @click="$emit('duplicate')"
      class="group p-2 rounded-lg transition-all border border-[rgba(143,143,143,0.32)] flex items-center gap-0 hover:gap-1.5"
      :class="{ 'w-max': wide }"
    >
      <n-icon :size="16" class="text-[#c9ccd2]">
        <CopyOutline />
      </n-icon>
      <span class="text-xs text-[#c9ccd2] max-w-0 overflow-hidden group-hover:max-w-[60px] transition-all duration-200 whitespace-nowrap">Copy</span>
    </NodeActionButton>
  </div>
</template>

<script setup>
import { NIcon } from 'naive-ui'
import { CopyOutline } from '@/icons/coolicons'
import NodeActionButton from '@/components/nodes/NodeActionButton.vue'

defineProps({
  visible: Boolean,
  positionClass: {
    type: String,
    default: 'right-0'
  },
  wide: Boolean
})

defineEmits(['duplicate'])
</script>
