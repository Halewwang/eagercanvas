<template>
  <AdminShell>
    <template #sidebar>
      <AdminSidebar
        :nav-items="navItems"
        :active-section="activeRouteName"
        :account-label="accountLabel"
        :roles="auth.roles.value"
        @select-section="navigate"
      />
    </template>

    <AdminMobileNav
      :nav-items="navItems"
      :active-section="activeRouteName"
      @select-section="navigate"
    />

    <RouterView />
  </AdminShell>
</template>

<script setup>
import { computed } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { AdminMobileNav, AdminShell, AdminSidebar } from '@/components/admin'
import { useAuthStore } from '@/stores/auth'
import { getAllowedAdminNavItems } from '@/utils/adminNavigation'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const navItems = computed(() => getAllowedAdminNavItems(auth.permissions.value))
const activeRouteName = computed(() => route.name === 'AdminUserDetail' ? 'AdminUsers' : String(route.name || ''))
const accountLabel = computed(() => auth.adminUser.value?.email || auth.user.value?.email || '-')

const navigate = (routeName) => {
  if (!routeName || route.name === routeName) return
  void router.push({ name: routeName })
}
</script>
