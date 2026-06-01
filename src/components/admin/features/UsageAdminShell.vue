<template>
  <AdminShell
    shell-class="text-white"
    frame-class="min-h-[calc(100vh-48px)]"
    main-class="min-h-[calc(100vh-48px)]"
  >
    <template #sidebar>
      <slot name="sidebar" />
    </template>

    <slot />
  </AdminShell>
</template>

<script setup>
import AdminShell from '@/components/admin/AdminShell.vue'
</script>
