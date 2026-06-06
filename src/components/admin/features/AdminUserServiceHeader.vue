<template>
  <AdminSectionHeader
    class="mb-5"
    title="用户服务"
    caption="围绕用户服务状态、开通操作、官方消耗和待处理事项组织。"
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
