<template>
  <AdminSidebarFrame
    brand-eyebrow="EagerCanvas"
    brand-title="Usage Admin"
    brand-caption="Eager 服务凭证管理与消耗复核。"
    session-title="Current session"
    :session-primary="sessionSummary.username"
    :session-secondary="sessionSummary.status"
  >
    <template #nav>
      <AdminSidebarNavItem
        v-for="item in navItems"
        :key="item.href"
        :label="item.label"
        :note="item.value"
        :active="item.active"
        :href="item.href"
      />
    </template>
  </AdminSidebarFrame>
</template>

<script setup>
import AdminSidebarFrame from '@/components/admin/AdminSidebarFrame.vue'
import AdminSidebarNavItem from '@/components/admin/AdminSidebarNavItem.vue'

defineProps({
  navItems: {
    type: Array,
    default: () => []
  },
  sessionSummary: {
    type: Object,
    default: () => ({
      username: 'Not signed in',
      status: 'Login required'
    })
  }
})
</script>
