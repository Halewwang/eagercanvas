<template>
  <header class="admin-page-header mb-8">
    <div class="admin-page-header-layout">
      <div class="admin-page-header-copy">
        <p class="admin-page-eyebrow">管理后台</p>
        <h1 class="admin-page-title">欢迎回来，{{ displayName }}</h1>
        <p class="admin-page-copy">
          按当前角色权限加载可管理区块，避免后台入口触发无效请求。
        </p>
      </div>
      <div class="admin-page-actions">
        <AdminHeaderActionButton :disabled="isRefreshing" @click="$emit('refresh')">
          {{ isRefreshing ? '刷新中...' : '刷新数据' }}
        </AdminHeaderActionButton>
        <AdminHeaderActionButton v-if="canReadUsers" @click="$emit('open-users')">用户服务</AdminHeaderActionButton>
        <AdminHeaderActionButton v-if="showServiceSection" @click="$emit('open-service')">消耗对账</AdminHeaderActionButton>
        <AdminHeaderActionButton @click="$emit('go-home')">返回首页</AdminHeaderActionButton>
      </div>
    </div>
    <div v-if="accessScope.length" class="admin-page-scope">
      <span>当前权限</span>
      <AdminPermissionChip v-for="item in accessScope" :key="`scope-${item}`" :label="item" />
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

<style scoped>
.admin-page-header {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 22px;
}

.admin-page-header-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}

.admin-page-header-copy {
  min-width: 0;
  max-width: 760px;
}

.admin-page-eyebrow {
  font-size: 12px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.45);
}

.admin-page-title {
  margin-top: 8px;
  color: rgba(255, 255, 255, 0.96);
  font-size: clamp(24px, 3vw, 32px);
  font-weight: 650;
  line-height: 1.16;
  overflow-wrap: anywhere;
}

.admin-page-copy {
  margin-top: 10px;
  color: rgba(255, 255, 255, 0.58);
  font-size: 14px;
  line-height: 1.65;
}

.admin-page-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.admin-page-scope {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
}

.admin-page-scope > span {
  color: rgba(255, 255, 255, 0.42);
  font-size: 12px;
}

@media (min-width: 900px) {
  .admin-page-header-layout {
    grid-template-columns: minmax(0, 1fr) minmax(220px, auto);
    align-items: start;
  }

  .admin-page-actions {
    justify-content: flex-end;
  }
}
</style>
