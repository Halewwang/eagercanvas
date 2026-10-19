<template>
  <p class="text-xs text-white/55">
    显示第 {{ userPageStart }}-{{ userPageEnd }} 条，共 {{ totalUsers }} 位用户
  </p>
</template>

<script setup>
defineProps({
  totalUsers: {
    type: Number,
    default: 0
  },
  userPageEnd: {
    type: Number,
    default: 0
  },
  userPageStart: {
    type: Number,
    default: 0
  }
})
</script>
