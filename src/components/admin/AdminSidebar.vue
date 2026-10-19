<template>
  <AdminSidebarFrame
    brand-eyebrow="EagerCanvas"
    brand-title="管理控制台"
    brand-caption="管理注册用户的权限与账户状态。"
    session-title="当前操作会话"
    :session-primary="accountLabel"
    :session-secondary="roleSummary"
  >
    <template #nav>
      <AdminSidebarNavItem
        v-for="item in navItems"
        :key="item.key"
        :icon="resolveSidebarNavIcon(item.key)"
        :label="item.label"
        :note="item.note"
        :active="activeSection === item.routeName"
        @select="$emit('select-section', item.routeName)"
      />
    </template>

  </AdminSidebarFrame>
</template>

<script setup>
import { computed } from 'vue'
import AdminSidebarFrame from './AdminSidebarFrame.vue'
import AdminSidebarNavItem from './AdminSidebarNavItem.vue'
import { UsersOutline } from '@/icons/coolicons'

defineEmits(['select-section'])

const props = defineProps({
  navItems: {
    type: Array,
    default: () => []
  },
  activeSection: {
    type: String,
    default: 'overview'
  },
  accessScope: {
    type: Array,
    default: () => []
  },
  accountLabel: {
    type: String,
    default: '-'
  },
  roles: {
    type: Array,
    default: () => []
  }
})

const roleSummary = computed(() => props.roles.join(', ') || '未加载角色')
const resolveSidebarNavIcon = () => UsersOutline
</script>
