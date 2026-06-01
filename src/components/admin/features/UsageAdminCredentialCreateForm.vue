<template>
  <UsageAdminSurface id="keys" surface-class="mb-8 scroll-mt-6 rounded-2xl p-5 md:p-6">
    <AdminSectionHeader
      class="mb-5"
      title="Create Eager Service Credential"
      caption="Create a credential, set budget limits, and assign it to users below."
    >
      <template #actions>
        <UsageAdminButton kind="micro" tone="primary" :disabled="creatingKey" @click="emit('create-api-key')">
          {{ creatingKey ? 'Creating...' : 'Create Credential' }}
        </UsageAdminButton>
      </template>
    </AdminSectionHeader>
    <div class="grid grid-cols-1 gap-3 md:grid-cols-4">
      <UsageAdminFormControl :value="createForm.api_name" placeholder="api_name" @input="updateCreateFormField('api_name', $event.target.value)" />
      <UsageAdminFormControl
        :value="createForm.limit_cost"
        type="number"
        min="0"
        placeholder="limit_cost"
        @input="updateCreateFormField('limit_cost', toNumberModelValue($event.target.value))"
      />
      <UsageAdminFormControl
        :value="createForm.limit_daily_cost"
        type="number"
        min="0"
        placeholder="limit_daily_cost"
        @input="updateCreateFormField('limit_daily_cost', toNumberModelValue($event.target.value))"
      />
      <UsageAdminFormControl
        :value="createForm.expired_on"
        type="number"
        min="0"
        placeholder="expired_on (unix sec)"
        @input="updateCreateFormField('expired_on', toNumberModelValue($event.target.value))"
      />
    </div>
    <div class="mt-4 flex flex-wrap gap-3 text-sm text-white/70">
      <UsageAdminCheckOption
        :checked="createForm.allow_save_logs"
        @change="updateCreateFormField('allow_save_logs', $event.target.checked)"
      >
        allow_save_logs
      </UsageAdminCheckOption>
      <UsageAdminCheckOption
        :checked="createForm.allow_custom_model"
        @change="updateCreateFormField('allow_custom_model', $event.target.checked)"
      >
        allow_custom_model
      </UsageAdminCheckOption>
      <UsageAdminCheckOption
        :checked="createForm.allow_manage_key"
        @change="updateCreateFormField('allow_manage_key', $event.target.checked)"
      >
        allow_manage_key
      </UsageAdminCheckOption>
    </div>
  </UsageAdminSurface>
</template>

<script setup>
import AdminSectionHeader from '@/components/admin/AdminSectionHeader.vue'
import UsageAdminButton from './UsageAdminButton.vue'
import UsageAdminCheckOption from './UsageAdminCheckOption.vue'
import UsageAdminFormControl from './UsageAdminFormControl.vue'
import UsageAdminSurface from './UsageAdminSurface.vue'

const emit = defineEmits(['create-api-key', 'update-create-form-field'])

defineProps({
  createForm: {
    type: Object,
    required: true
  },
  creatingKey: {
    type: Boolean,
    default: false
  }
})

const toNumberModelValue = (value) => {
  const parsed = Number.parseFloat(value)
  return Number.isNaN(parsed) ? value : parsed
}

const updateCreateFormField = (field, value) => {
  emit('update-create-form-field', field, value)
}
</script>
