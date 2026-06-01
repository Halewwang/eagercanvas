<template>
  <th class="px-3 py-4">用户</th>
  <th class="px-3 py-4">服务状态</th>
  <th class="px-3 py-4">官方消耗</th>
  <th class="px-3 py-4">对账</th>
  <th v-if="showUserActions" class="px-3 py-4">服务操作</th>
  <th v-if="canManageRoles || canManageUserStatus" class="px-3 py-4">账号与角色</th>
</template>

<script setup>
defineProps({
  canManageRoles: {
    type: Boolean,
    default: false
  },
  canManageUserStatus: {
    type: Boolean,
    default: false
  },
  showUserActions: {
    type: Boolean,
    default: false
  }
})
</script>
