<template>
  <AdminPanelCard
    title="消耗详情（请求 ID）"
    title-class="text-sm font-medium text-white"
    header-class="mb-3"
    panel-class="admin-panel-card rounded-2xl p-4"
  >
    <div class="flex flex-wrap gap-2">
      <AdminControlField
        :value="recordRequestId"
        placeholder="粘贴请求 ID"
        @input="updateRecordRequestId"
      />
      <AdminMicroButton :disabled="loadingRecord" @click="emit('query-record')">
        {{ loadingRecord ? '查询中...' : '查询' }}
      </AdminMicroButton>
    </div>
    <AdminServiceRecordSummary v-if="recordData" :record-data="recordData" />
  </AdminPanelCard>
</template>

<script setup>
import AdminControlField from '@/components/admin/AdminControlField.vue'
import AdminMicroButton from '@/components/admin/AdminMicroButton.vue'
import AdminPanelCard from '@/components/admin/AdminPanelCard.vue'
import AdminServiceRecordSummary from './AdminServiceRecordSummary.vue'

const emit = defineEmits(['query-record', 'update:recordRequestId'])

defineProps({
  loadingRecord: {
    type: Boolean,
    default: false
  },
  recordData: {
    type: Object,
    default: null
  },
  recordRequestId: {
    type: String,
    default: ''
  }
})

const updateRecordRequestId = (event) => {
  emit('update:recordRequestId', event.target.value)
}
</script>
