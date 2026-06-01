<template>
  <AdminPanelCard title="管理员会话">
    <div class="space-y-3 text-sm">
      <AdminInfoLine label="账号" :value="adminAccountLabel" />
      <AdminInfoLine label="角色" :value="formatRoleList(roles) || '-'" />
      <AdminInfoLine label="权限数" :value="permissionCount" />
      <AdminInfoLine label="状态" value="正常" value-class="text-white" />
    </div>
  </AdminPanelCard>
</template>

<script setup>
import AdminInfoLine from '@/components/admin/AdminInfoLine.vue'
import AdminPanelCard from '@/components/admin/AdminPanelCard.vue'

defineProps({
  adminAccountLabel: {
    type: String,
    default: '-'
  },
  formatRoleList: {
    type: Function,
    default: () => ''
  },
  permissionCount: {
    type: Number,
    default: 0
  },
  roles: {
    type: Array,
    default: () => []
  }
})
</script>
