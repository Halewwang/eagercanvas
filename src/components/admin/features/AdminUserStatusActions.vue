<template>
  <AdminEditorBlock v-if="canManageUserStatus">
    <p class="text-[11px] text-white/45">账号</p>
    <AdminEditorActions>
      <AdminMicroButton
        v-if="canManageUserStatus && user.status === 'active'"
        :disabled="statusLoading[user.id] || isSelf(user)"
        @click="emit('suspend-user', user)"
      >
        {{ isSelf(user) ? '禁止操作自己' : '暂停' }}
      </AdminMicroButton>
      <AdminMicroButton
        v-if="canManageUserStatus && user.status === 'suspended'"
        :disabled="statusLoading[user.id] || isSelf(user)"
        @click="emit('activate-user', user)"
      >
        {{ statusLoading[user.id] ? '更新中...' : (isSelf(user) ? '禁止操作自己' : '恢复') }}
      </AdminMicroButton>
      <AdminMicroButton
        v-if="canManageUserStatus"
        tone="danger"
        :disabled="deleting[user.id] || user.status === 'deleted' || isSelf(user)"
        @click="emit('delete-user', user)"
      >
        {{ deleting[user.id] ? '删除中...' : (isSelf(user) ? '禁止操作自己' : '删除') }}
      </AdminMicroButton>
    </AdminEditorActions>
  </AdminEditorBlock>
</template>

<script setup>
import AdminEditorActions from '@/components/admin/AdminEditorActions.vue'
import AdminEditorBlock from '@/components/admin/AdminEditorBlock.vue'
import AdminMicroButton from '@/components/admin/AdminMicroButton.vue'

const emit = defineEmits([
  'activate-user',
  'delete-user',
  'suspend-user'
])

const {
  canManageUserStatus,
  deleting,
  isSelf,
  statusLoading,
  user
} = defineProps({
  canManageUserStatus: {
    type: Boolean,
    default: false
  },
  deleting: {
    type: Object,
    default: () => ({})
  },
  isSelf: {
    type: Function,
    required: true
  },
  statusLoading: {
    type: Object,
    default: () => ({})
  },
  user: {
    type: Object,
    default: () => ({})
  }
})
</script>
