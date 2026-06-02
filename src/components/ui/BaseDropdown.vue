<template>
  <div ref="rootRef" class="relative inline-block">
    <div @click="toggle">
      <slot />
    </div>

    <div
      v-if="open"
      :class="menuClass"
      @click.stop
    >
      <template v-for="item in normalizedOptions" :key="item.key">
        <div v-if="item.type === 'divider'" class="mx-2 my-1.5 h-px bg-[rgba(255,255,255,0.12)]" />
        <button
          v-else
          type="button"
          class="flex w-full items-center gap-2 rounded-[14px] text-left transition-colors"
          :class="[
            props.compact ? 'px-3 py-2 text-[13px] leading-[1.25]' : 'ui-body px-3 py-2.5',
            item.danger
              ? 'text-[#ffb9b9] hover:bg-[rgba(255,99,99,0.12)]'
              : 'text-[var(--text)] hover:bg-[rgba(255,255,255,0.12)]'
          ]"
          :data-danger="item.danger ? 'true' : 'false'"
          @click="handleSelect(item.key)"
        >
          <NIcon
            v-if="item.icon"
            :size="15"
            class="shrink-0"
            :class="item.danger ? 'text-[#ff9f9f]' : 'text-[var(--text-muted)]'"
          >
            <component :is="item.icon" />
          </NIcon>
          <span class="min-w-0 truncate">{{ item.label }}</span>
        </button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { NIcon } from 'naive-ui'

const emit = defineEmits(['select', 'update:show'])

const props = defineProps({
  options: {
    type: Array,
    default: () => []
  },
  placement: {
    type: String,
    default: 'bottom-end'
  },
  compact: {
    type: Boolean,
    default: false
  },
  selectedKey: {
    type: [String, Number],
    default: undefined
  },
  show: {
    type: Boolean,
    default: undefined
  }
})

const rootRef = ref(null)
const uncontrolledOpen = ref(false)

const open = computed({
  get: () => (typeof props.show === 'boolean' ? props.show : uncontrolledOpen.value),
  set: (value) => {
    if (typeof props.show !== 'boolean') {
      uncontrolledOpen.value = value
    }
    emit('update:show', value)
  }
})

const normalizedOptions = computed(() =>
  props.options.map((item) => ({
    ...item,
    danger: item.key === 'delete' || item.danger === true,
    selected: typeof props.selectedKey === 'undefined' ? false : item.key === props.selectedKey
  }))
)

const menuClass = computed(() => {
  const placementClass = props.placement === 'bottom-end'
    ? 'right-0 top-[calc(100%+10px)]'
    : 'left-0 top-[calc(100%+10px)]'
  const densityClass = props.compact ? 'min-w-[168px] p-1.5' : 'min-w-[192px] p-2'

  return [
    'absolute z-[1300] rounded-[20px] border border-[rgba(255,255,255,0.06)] bg-[rgba(20,20,20,0.94)] shadow-[0_10px_24px_rgba(0,0,0,0.18)] backdrop-blur-[8px]',
    densityClass,
    placementClass
  ]
})

const toggle = (event) => {
  event.stopPropagation()
  open.value = !open.value
}

const handleSelect = (key) => {
  emit('select', key)
  open.value = false
}

const handlePointerDown = (event) => {
  if (!open.value) return
  if (rootRef.value?.contains(event.target)) return
  open.value = false
}

watch(open, (isOpen) => {
  if (isOpen) {
    document.addEventListener('pointerdown', handlePointerDown)
    return
  }
  document.removeEventListener('pointerdown', handlePointerDown)
}, { immediate: true })

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handlePointerDown)
})
</script>
