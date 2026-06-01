<template>
  <div class="mt-4 grid grid-cols-2 gap-2 text-xs text-white/75 md:grid-cols-5">
    <div>模型：{{ recordData.model || '-' }}</div>
    <div>成本：{{ recordData.cost ?? '-' }}</div>
    <div>输入：{{ recordData.input_token ?? '-' }}</div>
    <div>输出：{{ recordData.output_token ?? '-' }}</div>
    <div>耗时：{{ recordData.process_time ?? '-' }}</div>
  </div>
</template>

<script setup>
defineProps({
  recordData: {
    type: Object,
    required: true
  }
})
</script>
