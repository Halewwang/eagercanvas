<template>
  <button
    type="button"
    :class="buttonClasses"
    :disabled="disabled"
    @click="$emit('click', $event)"
  >
    <component
      :is="resolvedIcon"
      v-if="resolvedIcon"
      class="ui-micro-btn-icon"
      aria-hidden="true"
    />
    <span class="ui-micro-btn-label">
      <slot />
    </span>
  </button>
</template>

<script setup>
import { computed, useSlots } from 'vue'
import {
  AddOutline,
  ChevronBackOutline,
  ChevronForwardOutline,
  CloseCircleOutline,
  DownloadOutline,
  EyeOutline,
  HomeOutline,
  PauseCircleOutline,
  PlayCircleOutline,
  RefreshOutline,
  SaveOutline,
  SearchOutline,
  SettingsOutline,
  TrashOutline,
  ChatbubbleOutline
} from '@/icons/coolicons'

const props = defineProps({
  active: {
    type: Boolean,
    default: false
  },
  block: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  icon: {
    type: [Object, Function, String],
    default: ''
  },
  showIcon: {
    type: Boolean,
    default: true
  },
  size: {
    type: String,
    default: 'sm',
    validator: (value) => ['xs', 'sm', 'md'].includes(value)
  },
  tone: {
    type: String,
    default: 'default'
  }
})

defineEmits(['click'])

const slots = useSlots()

const iconMap = {
  add: AddOutline,
  close: CloseCircleOutline,
  detail: EyeOutline,
  download: DownloadOutline,
  export: DownloadOutline,
  filter: SearchOutline,
  home: HomeOutline,
  next: ChevronForwardOutline,
  pause: PauseCircleOutline,
  play: PlayCircleOutline,
  prev: ChevronBackOutline,
  refresh: RefreshOutline,
  save: SaveOutline,
  search: SearchOutline,
  settings: SettingsOutline,
  trash: TrashOutline,
  notify: ChatbubbleOutline
}

const getSlotText = (nodes = []) => nodes
  .map((node) => {
    if (typeof node.children === 'string') return node.children
    if (Array.isArray(node.children)) return getSlotText(node.children)
    return ''
  })
  .join('')
  .trim()

const resolveButtonIcon = (text = '') => {
  const value = String(text || '').trim()
  if (!value || /^\d+$/.test(value)) return null
  if (/返回首页/.test(value)) return iconMap.home
  if (/刷新|同步|重置/.test(value)) return iconMap.refresh
  if (/查询|搜索/.test(value)) return iconMap.search
  if (/详情|查看/.test(value)) return iconMap.detail
  if (/导出/.test(value)) return iconMap.export
  if (/通知/.test(value)) return iconMap.notify
  if (/保存/.test(value)) return iconMap.save
  if (/删除/.test(value)) return iconMap.trash
  if (/停用|暂停/.test(value)) return iconMap.pause
  if (/开通|恢复/.test(value)) return iconMap.play
  if (/调整/.test(value)) return iconMap.settings
  if (/清除|取消/.test(value)) return iconMap.close
  if (/上一页/.test(value)) return iconMap.prev
  if (/下一页/.test(value)) return iconMap.next
  return iconMap.detail
}

const resolvedIcon = computed(() => {
  if (!props.showIcon) return null
  if (typeof props.icon === 'string' && props.icon) return iconMap[props.icon] || null
  if (props.icon) return props.icon
  return resolveButtonIcon(getSlotText(slots.default?.() || []))
})

const buttonClasses = computed(() => ({
  'ui-micro-btn': true,
  [`ui-micro-btn-${props.size}`]: true,
  'ui-micro-btn-block': props.block,
  'ui-micro-btn-primary': props.tone === 'primary' || (props.active && props.tone !== 'danger'),
  'ui-micro-btn-danger': props.tone === 'danger'
}))
</script>

<style scoped>
.ui-micro-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.06);
  line-height: 1;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  transition: border-color 0.16s ease, background 0.16s ease, color 0.16s ease;
}

.ui-micro-btn-icon {
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
  opacity: 0.82;
}

.ui-micro-btn-label {
  min-width: 0;
  overflow-wrap: anywhere;
}

.ui-micro-btn-xs {
  min-height: 28px;
  padding: 4px 8px;
  font-size: 12px;
}

.ui-micro-btn-sm {
  min-height: 32px;
  padding: 6px 10px;
  font-size: 12px;
}

.ui-micro-btn-md {
  min-height: 38px;
  padding: 8px 14px;
  border-radius: 12px;
  font-size: 13px;
}

.ui-micro-btn-block {
  width: 100%;
}

.ui-micro-btn:not(:disabled):hover {
  border-color: rgba(255, 255, 255, 0.32);
  background: rgba(255, 255, 255, 0.1);
}

.ui-micro-btn:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.55);
  outline-offset: 2px;
}

.ui-micro-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.ui-micro-btn-primary {
  border-color: rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.16);
}

.ui-micro-btn-primary:not(:disabled):hover {
  border-color: rgba(255, 255, 255, 0.58);
  background: rgba(255, 255, 255, 0.2);
}

.ui-micro-btn-danger {
  border-color: rgba(120, 120, 120, 0.45);
  background: rgba(90, 90, 90, 0.2);
}
</style>
