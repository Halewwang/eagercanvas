<template>
  <CanvasGroupFloatingMenu :rect="rect">
    <button class="capsule-icon capsule-icon-solid capsule-create group-primary-btn" title="Group" @click="$emit('createGroup')">
      <NIcon :size="14"><AppsOutline /></NIcon>
      <span class="capsule-create-label">Group</span>
    </button>
  </CanvasGroupFloatingMenu>
</template>

<script setup>
import { NIcon } from 'naive-ui'
import { AppsOutline } from '@/icons/coolicons'
import CanvasGroupFloatingMenu from './CanvasGroupFloatingMenu.vue'

defineProps({
  rect: {
    type: Object,
    default: null
  }
})

defineEmits(['createGroup'])
</script>
