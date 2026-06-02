<template>
  <header class="main-header">
    <div class="main-header-copy">
      <h1>{{ title }}</h1>
      <p>{{ description }}</p>
    </div>
    <div class="header-actions">
      <WorkspaceActionPill @click="$emit('backHome')">
        <template #icon>
          <NIcon :size="15"><GridOutline /></NIcon>
        </template>
        Back Home
      </WorkspaceActionPill>
      <WorkspaceActionPill
        variant="primary"
        @click="$emit('createProject')"
      >
        <template #icon>
          <NIcon :size="15"><AddOutline /></NIcon>
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
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding-bottom: 20px;
  margin-bottom: 22px;
}

.main-header-copy {
  flex: 1 1 auto;
  min-width: 0;
}

.main-header h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.main-header p {
  margin: 0;
  color: rgba(236, 238, 244, 0.65);
  font-size: 13px;
  line-height: 1.55;
  max-width: min(760px, 100%);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-actions {
  display: flex;
  align-self: flex-start;
  gap: 8px;
  align-items: flex-start;
}

@media (max-width: 720px) {
  .main-header {
    flex-direction: column;
  }

  .main-header p {
    white-space: normal;
  }
}
</style>
