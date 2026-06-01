<template>
  <Handle type="target" :position="Position.Left" id="left" class="!bg-[#d6d8de] !border-2 !border-[#0f0f0f]" />
  <Handle type="source" :position="Position.Right" id="right" class="!bg-[#d6d8de] !border-2 !border-[#0f0f0f]" />
</template>

<script setup>
import { Handle, Position } from '@vue-flow/core'
</script>
