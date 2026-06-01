<template>
  <div :class="overflowClass">
    <table :class="['w-full text-sm', minWidthClass]">
      <thead>
        <tr :class="headerRowClass">
          <slot name="header" />
        </tr>
      </thead>
      <tbody>
        <slot :row-class="bodyRowClass" />
      </tbody>
    </table>
  </div>
</template>

<script setup>
defineProps({
  overflowClass: {
    type: [String, Array, Object],
    default: 'overflow-x-auto'
  },
  minWidthClass: {
    type: [String, Array, Object],
    default: ''
  },
  headerRowClass: {
    type: [String, Array, Object],
    default: 'border-b border-white/10 text-left text-xs uppercase tracking-[0.12em] text-white/40'
  },
  bodyRowClass: {
    type: [String, Array, Object],
    default: 'border-b border-white/5 align-top hover:bg-white/[0.03]'
  }
})
</script>
