<template>
  <AdminSectionHeader
    class="mb-5"
    title="注册用户"
    caption="管理注册用户的服务权限、角色和账户状态。"
  >
    <template #actions>
      <AdminMicroButton size="md" :disabled="loadingUsers" @click="emit('refresh-users')">
        {{ loadingUsers ? '刷新中...' : '刷新用户列表' }}
      </AdminMicroButton>
    </template>
  </AdminSectionHeader>
</template>

<script setup>
import AdminMicroButton from '@/components/admin/AdminMicroButton.vue'
import AdminSectionHeader from '@/components/admin/AdminSectionHeader.vue'

const emit = defineEmits(['refresh-users'])

defineProps({
  loadingUsers: {
    type: Boolean,
    default: false
  }
})
</script>
