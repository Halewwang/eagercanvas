<template>
  <AdminSectionHeader
    title="消耗对账"
    caption="官方消耗同步、请求查询和服务调用日志集中在这里处理。"
  >
    <template #actions>
      <AdminMicroButton :disabled="loading302" @click="emit('refresh-service-data')">
        {{ loading302 ? '刷新中...' : '刷新服务数据' }}
      </AdminMicroButton>
      <AdminMicroButton
        v-if="canReconcileBilling"
        tone="primary"
        :disabled="reconcilingBilling"
        @click="emit('reconcile-billing')"
      >
        {{ reconcilingBilling ? '同步中...' : '同步官方消耗' }}
      </AdminMicroButton>
    </template>
  </AdminSectionHeader>
</template>

<script setup>
import AdminMicroButton from '@/components/admin/AdminMicroButton.vue'
import AdminSectionHeader from '@/components/admin/AdminSectionHeader.vue'

const emit = defineEmits([
  'reconcile-billing',
  'refresh-service-data'
])

defineProps({
  canReconcileBilling: {
    type: Boolean,
    default: false
  },
  loading302: {
    type: Boolean,
    default: false
  },
  reconcilingBilling: {
    type: Boolean,
    default: false
  }
})
</script>
