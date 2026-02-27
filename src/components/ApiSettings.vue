<template>
  <!-- API Settings Modal | API 设置弹窗 -->
  <n-modal v-model:show="showModal" preset="card" title="API Settings" style="width: 560px;" class="custom-modal">
    <n-tabs type="line" animated>
      <!-- API 配置标签 -->
      <n-tab-pane name="api" tab="API">
        <n-form ref="formRef" :model="formData" label-placement="left" label-width="80">
          <n-form-item label="Base URL" path="baseUrl">
            <n-input 
              v-model:value="formData.baseUrl" 
              placeholder="https://api.chatfire.site/v1"
            />
          </n-form-item>
          <n-form-item label="API Key" path="apiKey">
            <n-input 
              v-model:value="formData.apiKey" 
              type="password"
              show-password-on="click"
              placeholder="Enter API Key"
            />
          </n-form-item>

          <n-divider title-placement="left" class="!my-3">
            <span class="text-xs text-[var(--text-secondary)]">Endpoints</span>
          </n-divider>
          
          <div class="endpoint-list">
            <div class="endpoint-item">
              <span class="endpoint-label">Chat</span>
              <n-tag size="small" class="endpoint-tag" :color="{ color: 'rgba(165, 129, 99, 0.1)', textColor: '#A58163', borderColor: 'rgba(165, 129, 99, 0.2)' }">/chat/completions</n-tag>
            </div>
            <div class="endpoint-item">
              <span class="endpoint-label">Image</span>
              <n-tag size="small" class="endpoint-tag" :color="{ color: 'rgba(165, 129, 99, 0.1)', textColor: '#A58163', borderColor: 'rgba(165, 129, 99, 0.2)' }">/images/generations</n-tag>
            </div>
            <div class="endpoint-item">
              <span class="endpoint-label">Video Create</span>
              <n-tag size="small" class="endpoint-tag" :color="{ color: 'rgba(165, 129, 99, 0.1)', textColor: '#A58163', borderColor: 'rgba(165, 129, 99, 0.2)' }">/videos</n-tag>
            </div>
            <div class="endpoint-item">
              <span class="endpoint-label">Video Status</span>
              <n-tag size="small" class="endpoint-tag" :color="{ color: 'rgba(165, 129, 99, 0.1)', textColor: '#A58163', borderColor: 'rgba(165, 129, 99, 0.2)' }">/videos/{taskId}</n-tag>
            </div>
          </div>

          <n-alert v-if="!isConfigured" type="warning" title="Not Configured" class="mb-4">
            <div class="flex flex-col gap-2">
              <p>Please configure an API key to use AI features.</p>
              <a 
                href="https://api.chatfire.site/login?inviteCode=EEE80324" 
                target="_blank"
                class="text-[var(--accent-color)] hover:underline text-sm flex items-center gap-1"
              >
                🔗 Get API Key
                <span class="text-xs">(new account)</span>
              </a>
            </div>
          </n-alert>

          <n-alert v-else type="success" title="Configured" class="mb-4">
            API is ready.
          </n-alert>
        </n-form>
      </n-tab-pane>

      <!-- 模型配置标签 -->
      <n-tab-pane name="models" tab="Models">
        <div class="model-config-section">
          <!-- 问答模型 -->
          <div class="model-group">
            <div class="model-group-header">
              <span class="model-group-title">Chat Models</span>
              <n-tag size="tiny" :color="{ color: 'rgba(165, 129, 99, 0.1)', textColor: '#A58163', borderColor: 'rgba(165, 129, 99, 0.2)' }">{{ allChatModels.length }}</n-tag>
            </div>
            <div class="model-input-row">
              <n-input 
                v-model:value="newChatModel" 
                placeholder="Model name, e.g. gpt-4o"
                size="small"
                @keyup.enter="handleAddChatModel"
              />
              <n-button size="small" color="#A58163" @click="handleAddChatModel" :disabled="!newChatModel">
                Add
              </n-button>
            </div>
            <div class="model-tags">
              <n-tag 
                v-for="model in allChatModels" 
                :key="model.key"
                size="small"
                :closable="model.isCustom"
                :color="model.isCustom ? { color: 'rgba(165, 129, 99, 0.1)', textColor: '#A58163', borderColor: 'rgba(165, 129, 99, 0.2)' } : undefined"
                @close="removeCustomChatModel(model.key)"
              >
                {{ model.label }}
              </n-tag>
            </div>
          </div>

          <!-- 图片模型 -->
          <div class="model-group">
            <div class="model-group-header">
              <span class="model-group-title">Image Models</span>
              <n-tag size="tiny" :color="{ color: 'rgba(165, 129, 99, 0.1)', textColor: '#A58163', borderColor: 'rgba(165, 129, 99, 0.2)' }">{{ allImageModels.length }}</n-tag>
            </div>
            <div class="model-input-row">
              <n-input 
                v-model:value="newImageModel" 
                placeholder="Model name, e.g. dall-e-3"
                size="small"
                @keyup.enter="handleAddImageModel"
              />
              <n-button size="small" color="#A58163" @click="handleAddImageModel" :disabled="!newImageModel">
                Add
              </n-button>
            </div>
            <div class="model-tags">
              <n-tag 
                v-for="model in allImageModels" 
                :key="model.key"
                size="small"
                :closable="model.isCustom"
                :color="model.isCustom ? { color: 'rgba(165, 129, 99, 0.1)', textColor: '#A58163', borderColor: 'rgba(165, 129, 99, 0.2)' } : undefined"
                @close="removeCustomImageModel(model.key)"
              >
                {{ model.label }}
              </n-tag>
            </div>
          </div>

          <!-- 视频模型 -->
          <div class="model-group">
            <div class="model-group-header">
              <span class="model-group-title">Video Models</span>
              <n-tag size="tiny" :color="{ color: 'rgba(165, 129, 99, 0.1)', textColor: '#A58163', borderColor: 'rgba(165, 129, 99, 0.2)' }">{{ allVideoModels.length }}</n-tag>
            </div>
            <div class="model-input-row">
              <n-input 
                v-model:value="newVideoModel" 
                placeholder="Model name, e.g. sora-2"
                size="small"
                @keyup.enter="handleAddVideoModel"
              />
              <n-button size="small" color="#A58163" @click="handleAddVideoModel" :disabled="!newVideoModel">
                Add
              </n-button>
            </div>
            <div class="model-tags">
              <n-tag 
                v-for="model in allVideoModels" 
                :key="model.key"
                size="small"
                :closable="model.isCustom"
                :color="model.isCustom ? { color: 'rgba(165, 129, 99, 0.1)', textColor: '#A58163', borderColor: 'rgba(165, 129, 99, 0.2)' } : undefined"
                @close="removeCustomVideoModel(model.key)"
              >
                {{ model.label }}
              </n-tag>
            </div>
          </div>
        </div>
      </n-tab-pane>
    </n-tabs>

    <template #footer>
      <div class="flex justify-between items-center">
        <a 
          href="https://api.chatfire.site/login?inviteCode=EEE80324" 
          target="_blank"
          class="text-xs text-[var(--text-secondary)] hover:text-[var(--accent-color)] transition-colors"
        >
          No API key? Register here
        </a>
        <div class="flex gap-2">
          <n-button @click="handleClear" tertiary>Clear</n-button>
          <n-button @click="showModal = false">Cancel</n-button>
          <n-button type="primary" color="#A58163" @click="handleSave">Save</n-button>
        </div>
      </div>
    </template>
  </n-modal>
</template>

<script setup>
/**
 * API Settings Component | API 设置组件
 * Modal for configuring API key, base URL, and custom models
 */
import { ref, reactive, watch } from 'vue'
import { NModal, NForm, NFormItem, NInput, NButton, NAlert, NDivider, NTag, NTabs, NTabPane } from 'naive-ui'
import { useApiConfig, useModelConfig } from '../hooks'

// Props | 属性
const props = defineProps({
  show: {
    type: Boolean,
    default: false
  }
})

// Emits | 事件
const emit = defineEmits(['update:show', 'saved'])

// API Config hook | API 配置 hook
const { apiKey, baseUrl, isConfigured, setApiKey, setBaseUrl, clear: clearConfig } = useApiConfig()

// Model Config hook | 模型配置 hook
const { 
  customChatModels, 
  customImageModels, 
  customVideoModels,
  allChatModels,
  allImageModels,
  allVideoModels,
  addCustomChatModel,
  addCustomImageModel,
  addCustomVideoModel,
  removeCustomChatModel,
  removeCustomImageModel,
  removeCustomVideoModel,
  clearCustomModels
} = useModelConfig()

// Modal visibility | 弹窗可见性
const showModal = ref(props.show)

// Form data | 表单数据
const formData = reactive({
  apiKey: apiKey.value,
  baseUrl: baseUrl.value
})

// New model inputs | 新模型输入
const newChatModel = ref('')
const newImageModel = ref('')
const newVideoModel = ref('')

// Watch prop changes | 监听属性变化
watch(() => props.show, (val) => {
  showModal.value = val
  if (val) {
    formData.apiKey = apiKey.value
    formData.baseUrl = baseUrl.value
  }
})

// Watch modal changes | 监听弹窗变化
watch(showModal, (val) => {
  emit('update:show', val)
})

// Handle add models | 处理添加模型
const handleAddChatModel = () => {
  if (newChatModel.value.trim()) {
    addCustomChatModel(newChatModel.value.trim())
    newChatModel.value = ''
  }
}

const handleAddImageModel = () => {
  if (newImageModel.value.trim()) {
    addCustomImageModel(newImageModel.value.trim())
    newImageModel.value = ''
  }
}

const handleAddVideoModel = () => {
  if (newVideoModel.value.trim()) {
    addCustomVideoModel(newVideoModel.value.trim())
    newVideoModel.value = ''
  }
}

// Handle save | 处理保存
const handleSave = () => {
  if (formData.apiKey) {
    setApiKey(formData.apiKey)
  }
  if (formData.baseUrl) {
    setBaseUrl(formData.baseUrl)
  }
  showModal.value = false
  emit('saved')
}

// Handle clear | 处理清除
const handleClear = () => {
  clearConfig()
  clearCustomModels()
  formData.apiKey = ''
  formData.baseUrl = 'https://api.chatfire.site/v1'
}
</script>

<style scoped>
.endpoint-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
  padding: 12px;
  background: var(--bg-secondary, #f5f5f5);
  border-radius: 6px;
}

.endpoint-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.endpoint-label {
  font-size: 13px;
  color: var(--text-secondary, #666);
  min-width: 70px;
}

.endpoint-tag {
  font-family: monospace;
  font-size: 12px;
}

.model-config-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.model-group {
  padding: 12px;
  background: var(--bg-secondary, #f5f5f5);
  border-radius: 8px;
}

.model-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.model-group-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary, #333);
}

.model-input-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.model-input-row .n-input {
  flex: 1;
}

.model-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
</style>
