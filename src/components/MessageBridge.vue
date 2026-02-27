<template></template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useMessage } from 'naive-ui'

const message = useMessage()

onMounted(() => {
  window.$message = message
})

onUnmounted(() => {
  if (window.$message === message) {
    delete window.$message
  }
})
</script>
