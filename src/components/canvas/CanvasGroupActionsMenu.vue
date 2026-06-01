<template>
  <CanvasGroupFloatingMenu :rect="rect">
    <div class="capsule-group">
      <button class="capsule-icon" title="Rename" @click="$emit('renameGroup')">
        <NIcon :size="14"><CreateOutline /></NIcon>
      </button>
      <button class="capsule-icon" title="Duplicate Group" @click="$emit('duplicateSelectedGroup')">
        <NIcon :size="14"><CopyOutline /></NIcon>
      </button>
      <button class="capsule-icon" title="Ungroup" @click="$emit('ungroupSelectedGroup')">
        <NIcon :size="14"><RemoveOutline /></NIcon>
      </button>
      <button class="capsule-icon group-danger-icon" title="Delete Group" @click="$emit('deleteSelectedGroup')">
        <NIcon :size="14"><TrashOutline /></NIcon>
      </button>
    </div>
  </CanvasGroupFloatingMenu>
</template>

<script setup>
import { NIcon } from 'naive-ui'
import {
  CopyOutline,
  CreateOutline,
  RemoveOutline,
  TrashOutline
} from '@/icons/coolicons'
import CanvasGroupFloatingMenu from './CanvasGroupFloatingMenu.vue'

defineProps({
  rect: {
    type: Object,
    default: null
  }
})

defineEmits(['renameGroup', 'duplicateSelectedGroup', 'ungroupSelectedGroup', 'deleteSelectedGroup'])
</script>
