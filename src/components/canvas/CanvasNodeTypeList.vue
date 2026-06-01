<template>
  <div class="node-menu-list">
    <button
      v-for="nodeType in nodeTypes"
      :key="nodeType.type"
      class="node-menu-item"
      @click="$emit('selectNodeType', nodeType.type)"
    >
      <div class="node-menu-item-icon">
        <NIcon :size="16" class="text-[#f3f4f6]"><component :is="getNodeTypeIcon(nodeType.type)" /></NIcon>
      </div>
      <div class="node-menu-item-copy">
        <span class="node-menu-item-title">{{ nodeType.name }}</span>
        <span class="node-menu-item-description">{{ nodeType.description }}</span>
      </div>
    </button>
  </div>
</template>

<script setup>
import { NIcon } from 'naive-ui'
import {
  ImageOutline,
  TextOutline,
  VideocamOutline
} from '@/icons/coolicons'

defineProps({
  nodeTypes: {
    type: Array,
    default: () => []
  }
})

defineEmits(['selectNodeType'])

const nodeTypeIcons = {
  text: TextOutline,
  image: ImageOutline,
  video: VideocamOutline
}

const getNodeTypeIcon = (type) => nodeTypeIcons[type] || TextOutline
</script>

<style scoped>
.node-menu-list {
  display: flex;
  flex-direction: column;
  margin-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 10px;
}

.node-menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 14px;
  position: relative;
  border-radius: 18px;
  padding: 14px 10px;
  background: transparent;
  border: 0;
  transition: background 0.18s ease, transform 0.18s ease;
}

.node-menu-item + .node-menu-item {
  margin-top: 10px;
  padding-top: 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.node-menu-item:hover {
  background: rgba(255, 255, 255, 0.045);
}

.node-menu-item-icon {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: #202020;
  border: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.node-menu-item-copy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  min-width: 0;
  padding-right: 12px;
}

.node-menu-item-title {
  font-size: 14px;
  line-height: 1.2;
  color: #f3f4f6;
  font-weight: 600;
}

.node-menu-item-description {
  font-size: 12px;
  line-height: 1.5;
  color: #9ca3af;
  text-align: left;
}
</style>
