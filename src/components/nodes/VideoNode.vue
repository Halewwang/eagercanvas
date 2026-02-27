<template>
  <!-- Video node wrapper for hover area | 视频节点包裹层，扩展悬浮区域 -->
  <div class="video-node-wrapper relative" @mouseenter="showActions = true" @mouseleave="showActions = false">
    <!-- Video node | 视频节点 -->
    <div 
      class="video-node bg-[var(--bg-secondary)] rounded-xl border w-[420px] relative transition-all duration-200"
      :class="data.selected ? 'border-1 border-blue-500 shadow-lg shadow-blue-500/20' : 'border border-[var(--border-color)]'"
      
    >
    <!-- Header | 头部 -->
    <div class="px-3 py-2 border-b border-[var(--border-color)]">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-[var(--text-secondary)]">{{ data.label }}</span>
        <div class="flex items-center gap-1">
          <button 
            @click="handleDelete"
            class="p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors"
          >
            <n-icon :size="14"><TrashOutline /></n-icon>
          </button>
          <!-- <button class="p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors">
            <n-icon :size="14"><ExpandOutline /></n-icon>
          </button> -->
        </div>
      </div>
      <!-- Model name | Model名称 -->
      <div v-if="data.model" class="mt-1 text-xs text-[var(--text-secondary)] truncate">
        {{ data.model }}
      </div>
    </div>
    
    <!-- Video preview area | 视频Preview区域 -->
    <div class="p-3">
      <!-- Loading state | 加载状态 -->
      <div 
        v-if="data.loading"
        class="aspect-video rounded-lg bg-gradient-to-br from-cyan-400 via-blue-300 to-amber-200 flex flex-col items-center justify-center gap-3 relative overflow-hidden"
      >
        <!-- Animated gradient overlay | 动画渐变遮罩 -->
        <div class="absolute inset-0 bg-gradient-to-br from-cyan-500/20 via-blue-400/20 to-amber-300/20 animate-pulse"></div>
        
        <!-- Loading image | 加载图片 -->
        <div class="relative z-10">
          <img 
            src="../../assets/loading.webp" 
            alt="Loading" 
            class="w-14 h-12"
          />
        </div>
        
        <span class="text-sm text-white font-medium relative z-10">In progress, ~1 minute</span>
      </div>
      <!-- Error state | 错误状态 -->
      <div 
        v-else-if="data.error"
        class="aspect-video rounded-lg bg-red-50 dark:bg-red-900/20 flex flex-col items-center justify-center gap-2 border border-red-200 dark:border-red-800"
      >
        <n-icon :size="32" class="text-red-500"><CloseCircleOutline /></n-icon>
        <span class="text-sm text-red-500">{{ data.error }}</span>
      </div>
      <!-- Video preview | 视频Preview -->
      <div 
        v-else-if="data.url"
        class="aspect-video rounded-lg overflow-hidden bg-black"
      >
        <video 
          :src="data.url" 
          controls 
          class="w-full h-full object-contain"
        />
      </div>
      <!-- Empty state | 空状态 -->
      <div 
        v-else
        class="aspect-video rounded-lg bg-[var(--bg-tertiary)] flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[var(--border-color)] relative"
      >
        <n-icon :size="32" class="text-[var(--text-secondary)]"><VideocamOutline /></n-icon>
        <span class="text-sm text-[var(--text-secondary)]">Drop a video or click to upload</span>
        <input 
          type="file" 
          accept="video/*" 
          class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          @change="handleFileUpload"
        />
        <div class="w-full px-4 flex gap-2 relative z-10 pointer-events-auto">
          <input 
            type="text" 
            v-model="inputUrl"
            placeholder="Enter video URL..." 
            class="flex-1 px-2 py-1 text-sm bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg outline-none focus:border-[var(--accent-color)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] min-w-0"
            @keydown.enter.stop="handleUrlInput"
            @click.stop
          />
          <button 
            @click.stop="handleUrlInput"
            :disabled="!inputUrl"
            class="flora-button-primary px-3 py-1 text-xs rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            Load
          </button>
        </div>
      </div>
      
      <!-- Duration info | Duration信息 -->
      <div v-if="data.duration" class="mt-2 text-xs text-[var(--text-secondary)]">
        Duration: {{ formatDuration(data.duration) }}
      </div>
    </div>

    <!-- Handles | 连接点 -->
    <Handle type="source" :position="Position.Right" id="right" class="!bg-[var(--accent-color)]" />
    <Handle type="target" :position="Position.Left" id="left" class="!bg-[var(--accent-color)]" />
    </div>

    <!-- Hover action buttons | 悬浮操作按钮 -->
    <!-- Top right - Copy button | 右上角 - Copy按钮 -->
    <div 
      v-show="showActions"
      class="absolute -top-5 right-12 z-[1000]"
    >
      <button 
        @click="handleDuplicate"
        class="action-btn group p-2 bg-white rounded-lg transition-all border border-gray-200 flex items-center gap-0 hover:gap-1.5 w-max"
      >
        <n-icon :size="16" class="text-gray-600"><CopyOutline /></n-icon>
        <span class="text-xs text-gray-600 max-w-0 overflow-hidden group-hover:max-w-[60px] transition-all duration-200 whitespace-nowrap">Copy</span>
      </button>
    </div>

    <!-- Right side - Action buttons | 右侧 - 操作按钮 -->
    <div 
      v-show="showActions && data.url"
      class="absolute right-10 top-20 -translate-y-1/2 translate-x-full flex flex-col gap-2 z-[1000]"
    >
      <!-- Preview button | Preview按钮 -->
      <button 
        @click="handlePreview"
        class="action-btn group p-2 bg-white rounded-lg transition-all border border-gray-200 flex items-center gap-0 hover:gap-1.5 w-max"
      >
        <n-icon :size="16" class="text-gray-600"><EyeOutline /></n-icon>
        <span class="text-xs text-gray-600 max-w-0 overflow-hidden group-hover:max-w-[80px] transition-all duration-200 whitespace-nowrap">Preview</span>
      </button>
      <!-- Download button | Download按钮 -->
      <button 
        @click="handleDownload"
        class="action-btn group p-2 bg-white rounded-lg transition-all border border-gray-200 flex items-center gap-0 hover:gap-1.5 w-max"
      >
        <n-icon :size="16" class="text-gray-600"><DownloadOutline /></n-icon>
        <span class="text-xs text-gray-600 max-w-0 overflow-hidden group-hover:max-w-[80px] transition-all duration-200 whitespace-nowrap">Download</span>
      </button>
    </div>
  </div>
</template>

<script setup>
/**
 * Video node component | 视频节点组件
 * Displays and manages video content
 */
import { ref } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { NIcon, NSpin } from 'naive-ui'
import { TrashOutline, ExpandOutline, VideocamOutline, CopyOutline, CloseCircleOutline, DownloadOutline, EyeOutline } from '../../icons/coolicons'
import { updateNode, removeNode, duplicateNode } from '../../stores/canvas'

const props = defineProps({
  id: String,
  data: Object
})

// Input URL state | 输入URL状态
const inputUrl = ref('')

// Hover state | 悬浮状态
const showActions = ref(false)

// Handle URL input | 处理URL输入
const handleUrlInput = () => {
  if (inputUrl.value) {
    updateNode(props.id, { 
      url: inputUrl.value,
      updatedAt: Date.now()
    })
    inputUrl.value = ''
  }
}

// Handle file upload | 处理文件上传
const handleFileUpload = (event) => {
  const file = event.target.files[0]
  if (file) {
    const url = URL.createObjectURL(file)
    updateNode(props.id, { 
      url,
      updatedAt: Date.now()
    })
  }
}

// Format duration | 格式化Duration
const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Handle delete | 处理删除
const handleDelete = () => {
  removeNode(props.id)
}

// Handle preview | 处理Preview
const handlePreview = () => {
  if (props.data.url) {
    window.open(props.data.url, '_blank')
  }
}

// Handle download | 处理Download
const handleDownload = () => {
  if (props.data.url) {
    const link = document.createElement('a')
    link.href = props.data.url
    link.download = props.data.fileName || `video_${Date.now()}.mp4`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.$message?.success('Video download started...')
  }
}

// Handle duplicate | 处理Copy
const handleDuplicate = () => {
  const newId = duplicateNode(props.id)
  if (newId) {
    // Clear selection and select the new node | Clear选中并选中新节点
    updateNode(props.id, { selected: false })
    updateNode(newId, { selected: true })
    window.$message?.success('Node duplicated')
  }
}
</script>

<style scoped>
.video-node-wrapper {
  padding-right: 50px;
  padding-top: 20px;
}

.video-node {
  cursor: default;
}
</style>
