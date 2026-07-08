<template>
  <BaseModal
    :show="show"
    title="绑定服务 Key"
    description="保存后该用户将使用绑定的用户运行时模型调用 Key 调用模型。不要填写 DASHBOARD_302_API_KEY 或 PROVIDER_API_KEY。"
    size="sm"
    :close-on-overlay="!loading"
    :close-on-escape="!loading"
    @update:show="handleShowUpdate"
  >
    <form class="admin-manual-key-form" @submit.prevent="submit">
      <BaseInput
        v-model="apiName"
        label="302 Key 名称"
        placeholder="用于官方对账的 api_name"
        :disabled="loading"
        autocomplete="off"
        spellcheck="false"
      />
      <BaseInput
        v-model="apiKey"
        label="完整 302 API Key"
        type="password"
        placeholder="请输入完整 302 API Key"
        :disabled="loading"
        autocomplete="off"
        spellcheck="false"
      />
      <p class="admin-manual-key-help">
        不能使用系统管理 Key；请粘贴在 302.ai 为该用户单独创建的普通运行时 API Key。
      </p>
      <p v-if="errorMessage" class="admin-manual-key-error">{{ errorMessage }}</p>
    </form>

    <template #footer>
      <BaseModalActions>
        <AdminMicroButton
          icon="close"
          :disabled="loading"
          @click="close"
        >
          取消
        </AdminMicroButton>
        <AdminEditorMainButton
          icon="save"
          :disabled="loading || !apiKey.trim()"
          @click="submit"
        >
          {{ loading ? '绑定中' : '绑定服务 Key' }}
        </AdminEditorMainButton>
      </BaseModalActions>
    </template>
  </BaseModal>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import AdminEditorMainButton from '@/components/admin/AdminEditorMainButton.vue'
import AdminMicroButton from '@/components/admin/AdminMicroButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseModalActions from '@/components/ui/BaseModalActions.vue'

const props = defineProps({
  loading: {
    type: Boolean,
    default: false
  },
  show: {
    type: Boolean,
    default: false
  },
  user: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:show', 'close', 'submit'])

const apiName = ref('')
const apiKey = ref('')
const errorMessage = ref('')

const defaultApiName = computed(() => {
  const existingName = String(props.user?.service?.providerApiName || '').trim()
  if (existingName) return existingName

  const userId = String(props.user?.id || '').replace(/-/g, '').slice(0, 16)
  return userId ? `manual_${userId}` : ''
})

const resetForm = () => {
  apiName.value = defaultApiName.value
  apiKey.value = ''
  errorMessage.value = ''
}

const handleShowUpdate = (value) => {
  emit('update:show', value)
  if (!value) emit('close')
}

const close = () => {
  if (props.loading) return
  handleShowUpdate(false)
}

const submit = () => {
  if (props.loading) return
  errorMessage.value = ''

  const nextApiKey = apiKey.value.trim()
  if (!nextApiKey) {
    errorMessage.value = '请输入完整 302 API Key'
    return
  }

  emit('submit', {
    apiName: apiName.value.trim() || defaultApiName.value,
    apiKey: nextApiKey
  })
}

watch(
  () => [props.show, props.user?.id],
  ([visible]) => {
    if (visible) resetForm()
  },
  { immediate: true }
)
</script>

<style scoped>
.admin-manual-key-form {
  display: grid;
  gap: 18px;
}

.admin-manual-key-error {
  margin: 0;
  color: rgba(255, 205, 215, 0.82);
  font-size: 12px;
  line-height: 1.45;
}

.admin-manual-key-help {
  margin: -8px 0 0;
  color: rgba(255, 255, 255, 0.48);
  font-size: 12px;
  line-height: 1.5;
}
</style>
