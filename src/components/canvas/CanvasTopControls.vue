<template>
  <div class="absolute left-4 top-4 z-20 flex items-center gap-2">
    <CanvasSurface class="rounded-full p-1.5">
      <CanvasPillButton title="Workspace" @click="$emit('workspace')">
        <n-icon :size="18"><ChevronBackOutline /></n-icon>
        <span class="text-sm font-medium">Workspace</span>
      </CanvasPillButton>
    </CanvasSurface>
    <CanvasSurface class="rounded-full p-1.5">
      <BaseDropdown :options="projectOptions" compact @select="$emit('project-action', $event)">
        <CanvasPillButton compact>
          <span class="text-sm font-medium">{{ projectName }}</span>
          <n-icon :size="16"><ChevronDownOutline /></n-icon>
        </CanvasPillButton>
      </BaseDropdown>
    </CanvasSurface>
  </div>

  <div class="absolute right-4 top-4 z-20 flex items-center gap-2">
    <CanvasSurface
      v-if="syncIndicator"
      class="canvas-sync-pill rounded-full px-3 py-2"
      :title="syncIndicator.title"
    >
      <div class="flex items-center gap-2 text-xs font-medium">
        <span
          class="h-2 w-2 rounded-full"
          :class="syncIndicator.dotClass"
        />
        <span>{{ syncIndicator.label }}</span>
        <button
          v-if="showRemoteRefreshControl"
          class="canvas-sync-refresh-btn"
          :disabled="remoteRefreshAction === 'refresh'"
          title="Refresh from cloud"
          @click.stop="$emit('remote-refresh')"
        >
          <n-icon :size="13"><RefreshOutline /></n-icon>
          <span>{{ remoteRefreshAction === 'refresh' ? 'Refreshing' : 'Refresh cloud' }}</span>
        </button>
      </div>
    </CanvasSurface>
    <CanvasSurface class="rounded-full p-1.5">
      <CanvasPillButton title="Share" @click="$emit('share')">
        <n-icon :size="16"><CopyOutline /></n-icon>
        <span class="text-sm font-medium">Share</span>
      </CanvasPillButton>
    </CanvasSurface>
  </div>
</template>

<script setup>
import { NIcon } from 'naive-ui'
import { BaseDropdown } from '@/components/ui'
import { ChevronBackOutline, ChevronDownOutline, CopyOutline, RefreshOutline } from '@/icons/coolicons'
import CanvasPillButton from './CanvasPillButton.vue'
import CanvasSurface from './CanvasSurface.vue'

defineProps({
  projectOptions: {
    type: Array,
    default: () => []
  },
  projectName: {
    type: String,
    default: ''
  },
  syncIndicator: {
    type: Object,
    default: null
  },
  showRemoteRefreshControl: {
    type: Boolean,
    default: false
  },
  remoteRefreshAction: {
    type: String,
    default: ''
  }
})

defineEmits(['workspace', 'project-action', 'remote-refresh', 'share'])
</script>

<style scoped>
.canvas-sync-pill {
  flex: 0 1 auto;
  min-width: 110px;
  width: auto;
  height: 50px;
  display: flex;
  align-self: auto;
  justify-content: center;
  align-items: center;
}

.canvas-sync-refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  margin-left: 4px;
  padding: 0 9px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.9);
  font-size: 11px;
  line-height: 1;
  white-space: nowrap;
}

.canvas-sync-refresh-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.11);
  border-color: rgba(255, 255, 255, 0.24);
}

.canvas-sync-refresh-btn:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}
</style>
