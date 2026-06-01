<template>
  <header class="main-header">
    <div>
      <h1>{{ title }}</h1>
      <p>{{ description }}</p>
    </div>
    <div class="header-actions">
      <WorkspaceActionPill @click="$emit('backHome')">
        <template #icon>
          <NIcon :size="18"><GridOutline /></NIcon>
        </template>
        Back Home
      </WorkspaceActionPill>
      <WorkspaceActionPill
        variant="primary"
        @click="$emit('createProject')"
      >
        <template #icon>
          <NIcon :size="16"><AddOutline /></NIcon>
        </template>
        New Project
      </WorkspaceActionPill>
    </div>
  </header>
</template>

<script setup>
import { NIcon } from 'naive-ui'
import { AddOutline, GridOutline } from '@/icons/coolicons'
import WorkspaceActionPill from './WorkspaceActionPill.vue'

defineProps({
  title: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  }
})

defineEmits(['backHome', 'createProject'])
</script>

<style scoped>
.main-header {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding-bottom: 20px;
  margin-bottom: 22px;
}

.main-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.main-header p {
  margin: 10px 0 0;
  color: rgba(236, 238, 244, 0.65);
  font-size: 13px;
  line-height: 1.55;
  max-width: 560px;
}

.header-actions {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
</style>
