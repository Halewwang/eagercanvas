<template>
  <div class="flex items-center justify-between px-3 py-2 border-b border-[rgba(143,143,143,0.28)]">
    <div class="flex items-center gap-2">
      <slot name="icon" />
      <span class="text-sm font-medium text-[#d7dbe3]">{{ label }}</span>
    </div>
    <div class="flex items-center gap-1">
      <ConfigNodeIconButton type="button" @click="$emit('delete')">
        <TrashOutline />
      </ConfigNodeIconButton>
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup>
import { TrashOutline } from '@/icons/coolicons'
import ConfigNodeIconButton from './ConfigNodeIconButton.vue'

defineProps({
  label: {
    type: String,
    default: ''
  }
})

defineEmits(['delete'])
</script>
