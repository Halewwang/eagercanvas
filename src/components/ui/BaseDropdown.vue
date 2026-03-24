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
        <div v-if="item.type === 'divider'" class="mx-2 my-1 h-px bg-white/8" />
        <button
          v-else
          type="button"
          class="ui-body flex w-full items-center rounded-[14px] px-3 py-2.5 text-left transition-colors"
          :class="item.danger ? 'text-[var(--text)] hover:bg-white/6' : 'text-[var(--text)] hover:bg-white/6'"
          @click="handleSelect(item.key)"
        >
          {{ item.label }}
        </button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

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
    danger: item.key === 'delete' || item.danger === true
  }))
)

const menuClass = computed(() => {
  const placementClass = props.placement === 'bottom-end'
    ? 'right-0 top-[calc(100%+10px)]'
    : 'left-0 top-[calc(100%+10px)]'

  return [
    'absolute z-[1300] min-w-[192px] rounded-[20px] border border-white/8 bg-[rgba(20,20,20,0.96)] p-2 shadow-[0_12px_28px_rgba(0,0,0,0.24)] backdrop-blur-[10px]',
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
