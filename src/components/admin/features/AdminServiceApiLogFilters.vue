<template>
  <AdminFilterToolbar>
    <AdminFilterField label="开始时间">
      <AdminControlField
        :value="log302Query.start"
        type="datetime-local"
        class="!w-[190px]"
        @input="updateLogQuery('start', $event)"
      />
    </AdminFilterField>
    <AdminFilterField label="结束时间">
      <AdminControlField
        :value="log302Query.end"
        type="datetime-local"
        class="!w-[190px]"
        @input="updateLogQuery('end', $event)"
      />
    </AdminFilterField>
    <AdminFilterField label="页码">
      <AdminControlField
        :value="log302Query.page"
        type="number"
        min="1"
        variant="number"
        @input="updateNumericLogQuery('page', $event)"
      />
    </AdminFilterField>
    <AdminFilterField label="每页">
      <AdminControlField
        :value="log302Query.limit"
        type="number"
        min="1"
        max="50"
        variant="number"
        @input="updateNumericLogQuery('limit', $event)"
      />
    </AdminFilterField>
    <AdminMicroButton :disabled="loadingApiLogs" @click="emit('load-api-logs')">查询</AdminMicroButton>
  </AdminFilterToolbar>
</template>

<script setup>
import AdminControlField from '@/components/admin/AdminControlField.vue'
import AdminFilterField from '@/components/admin/AdminFilterField.vue'
import AdminFilterToolbar from '@/components/admin/AdminFilterToolbar.vue'
import AdminMicroButton from '@/components/admin/AdminMicroButton.vue'

const emit = defineEmits(['load-api-logs', 'update-log-query'])

defineProps({
  loadingApiLogs: {
    type: Boolean,
    default: false
  },
  log302Query: {
    type: Object,
    default: () => ({ page: 1, limit: 20, start: '', end: '' })
  }
})

const updateLogQuery = (key, event) => {
  emit('update-log-query', key, event.target.value)
}

const updateNumericLogQuery = (key, event) => {
  const value = event.target.value === '' ? '' : Number(event.target.value)
  emit('update-log-query', key, value)
}
</script>
