<template>
  <div
    class="flex items-center gap-2 text-xs text-[#8f939e] py-1 border-t border-[rgba(143,143,143,0.28)]"
    :class="{ 'flex-wrap': wrap }"
  >
    <span
      v-for="item in items"
      :key="item.key"
      class="px-3 py-1 rounded-full"
      :class="item.active ? 'bg-[#2a2a2a] text-[#f2f3f5] border border-[rgba(255,255,255,0.62)]' : 'bg-[#1a1a1a] text-[#818793] border border-[rgba(143,143,143,0.36)]'"
    >
      {{ item.label }}
    </span>
  </div>
</template>

<script setup>
defineProps({
  items: {
    type: Array,
    default: () => []
  },
  wrap: Boolean
})
</script>
