<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { bindNetworkStatusListeners } from './networkStatus'

const props = defineProps({
  syncOfflineDrafts: Function
})

const isOnline = ref(true)
let stopNetworkStatusListeners = () => {}

onMounted(() => {
  stopNetworkStatusListeners = bindNetworkStatusListeners({
    isOnline,
    syncOfflineDrafts: props.syncOfflineDrafts
  })
})

onBeforeUnmount(() => {
  stopNetworkStatusListeners()
})
</script>

<template>
  <div v-if="!isOnline" role="status">
    当前处于离线状态，本地草稿会继续保留，恢复网络后将按现有同步流程处理。
  </div>
</template>

<style scoped>
div {
  position: fixed;
  inset: 0 0 auto;
  z-index: 2000;
  padding: 10px 20px;
  border-bottom: 1px solid #f59e0b47;
  color: #111827;
  background: #fbbf24;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.25;
  text-align: center;
}
</style>
