<template>
  <header class="mb-8 border-b border-white/10 pb-6">
    <div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div class="max-w-3xl">
        <p class="text-xs uppercase tracking-[0.2em] text-white/45">管理后台</p>
        <h1 class="mt-2 text-2xl font-semibold text-white md:text-3xl">欢迎回来，{{ displayName }}</h1>
        <p class="mt-3 text-sm leading-6 text-white/55">
          当前页面会按权限显示可管理区块，并且只请求当前角色可访问的数据，避免进入后台即触发无效接口。
        </p>
        <div class="mt-4 flex flex-wrap gap-2">
          <AdminPermissionChip v-for="item in accessScope" :key="`scope-${item}`" :label="item" />
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <AdminHeaderActionButton :disabled="isRefreshing" @click="$emit('refresh')">
          {{ isRefreshing ? '刷新中...' : '刷新当前可见数据' }}
        </AdminHeaderActionButton>
        <AdminHeaderActionButton v-if="canReadUsers" @click="$emit('open-users')">用户服务</AdminHeaderActionButton>
        <AdminHeaderActionButton v-if="showServiceSection" @click="$emit('open-service')">消耗对账</AdminHeaderActionButton>
        <AdminHeaderActionButton @click="$emit('go-home')">返回首页</AdminHeaderActionButton>
      </div>
    </div>
  </header>
</template>

<script setup>
import AdminHeaderActionButton from './AdminHeaderActionButton.vue'
import AdminPermissionChip from './AdminPermissionChip.vue'

defineEmits(['refresh', 'open-users', 'open-service', 'go-home'])

defineProps({
  displayName: {
    type: String,
    default: '管理员'
  },
  accessScope: {
    type: Array,
    default: () => []
  },
  isRefreshing: {
    type: Boolean,
    default: false
  },
  canReadUsers: {
    type: Boolean,
    default: false
  },
  showServiceSection: {
    type: Boolean,
    default: false
  }
})
</script>
