<template>
  <AdminPanelCard
    title="消耗详情（请求 ID）"
    caption="按 request_id 查看单次调用的成本和用量明细。"
    title-class="text-sm font-medium text-white"
    header-class="mb-3"
    panel-class="admin-panel-card rounded-2xl p-4"
  >
    <AdminFilterToolbar>
      <AdminFilterField label="请求 ID">
        <AdminControlField
          :value="recordRequestId"
          placeholder="粘贴请求 ID"
          @input="updateRecordRequestId"
        />
      </AdminFilterField>
      <AdminMicroButton :disabled="loadingRecord" @click="emit('query-record')">
        {{ loadingRecord ? '查询中...' : '查询' }}
      </AdminMicroButton>
    </AdminFilterToolbar>
    <AdminServiceRecordSummary v-if="recordData" :record-data="recordData" />
    <AdminEmptyState v-else>
      输入请求 ID 后查看成本、Token 和处理耗时。
    </AdminEmptyState>
  </AdminPanelCard>
</template>

<script setup>
import AdminControlField from '@/components/admin/AdminControlField.vue'
import AdminEmptyState from '@/components/admin/AdminEmptyState.vue'
import AdminFilterField from '@/components/admin/AdminFilterField.vue'
import AdminFilterToolbar from '@/components/admin/AdminFilterToolbar.vue'
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
