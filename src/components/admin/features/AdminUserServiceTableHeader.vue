<template>
  <th class="px-3 py-4">用户</th>
  <th class="px-3 py-4">官方消耗</th>
  <th class="px-3 py-4">对账</th>
  <th v-if="showUserActions || canManageRoles || canManageUserStatus" class="px-3 py-4">操作与权限</th>
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
