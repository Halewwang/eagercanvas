<template>
  <div v-if="show" class="admin-mutation-backdrop" @click.self="emit('close')">
    <section
      class="admin-mutation-dialog"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      @keydown.esc="emit('close')"
    >
      <header>
        <p class="text-xs uppercase tracking-[0.16em] text-white/40">用户变更</p>
        <h2 :id="titleId" class="mt-1 text-lg font-semibold text-white">{{ actionCopy.title }}</h2>
        <p class="mt-1 text-xs text-white/50">{{ user?.email || user?.id || '未知用户' }}</p>
      </header>

      <div class="rounded-xl border border-amber-300/15 bg-amber-300/5 p-3">
        <p class="text-xs font-semibold text-amber-100">影响</p>
        <ul class="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-white/60">
          <li v-for="item in actionCopy.impacts" :key="item">{{ item }}</li>
        </ul>
      </div>

      <label class="grid gap-1.5 text-xs text-white/60">
        操作原因
        <textarea v-model="reason" rows="3" class="admin-mutation-control" placeholder="请输入可审计的操作原因" :disabled="loading || !desktopEnabled" />
      </label>

      <label v-if="action === 'archive'" class="grid gap-1.5 text-xs text-white/60">
        输入完整邮箱确认删除
        <input v-model="confirmation" type="email" autocomplete="off" class="admin-mutation-control" :placeholder="user?.email || ''" :disabled="loading || !desktopEnabled">
      </label>

      <p v-if="!desktopEnabled" class="text-xs text-white/45">请使用桌面端完成此操作</p>

      <footer class="flex justify-end gap-2">
        <button type="button" class="admin-mutation-secondary" :disabled="loading" @click="emit('close')">取消</button>
        <button type="button" class="admin-mutation-primary" :disabled="loading || !desktopEnabled" @click="submit">{{ loading ? '提交中…' : actionCopy.submit }}</button>
      </footer>
    </section>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const ACTION_COPY = {
  suspend: { title: '暂停用户', submit: '确认暂停', impacts: ['阻止用户继续访问受保护功能', '保留账号、角色和历史数据'] },
  resume: { title: '恢复用户状态', submit: '确认恢复', impacts: ['恢复账号访问状态', '不修改现有角色和服务权限'] },
  archive: { title: '删除账户', submit: '确认删除', impacts: ['软删除账号并阻止登录', '保留审计和历史数据'] },
  restore: { title: '恢复已删除账户', submit: '确认恢复', impacts: ['撤销账号删除状态', '恢复后账号保持暂停，仍不会立即恢复登录或服务'] },
  'disable-service': { title: '暂停服务', submit: '确认暂停', impacts: ['停止文字、图片和视频模型的调用权限', '保留账号、角色和历史数据'] }
}

const emit = defineEmits(['close', 'submit'])
const props = defineProps({
  action: { type: String, default: '' },
  desktopEnabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  show: { type: Boolean, default: false },
  user: { type: Object, default: null }
})

const reason = ref('')
const confirmation = ref('')
const titleId = 'admin-user-mutation-title'
const actionCopy = computed(() => ACTION_COPY[props.action] || { title: '用户变更', submit: '确认', impacts: ['记录并执行本次管理操作'] })

watch(() => [props.show, props.action, props.user?.id], ([show]) => {
  if (!show) return
  reason.value = ''
  confirmation.value = ''
})

const submit = () => {
  if (!props.desktopEnabled) return
  emit('submit', {
    reason: reason.value,
    confirmation: confirmation.value
  })
}
</script>

<style scoped>
.admin-mutation-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(2, 6, 23, 0.78);
  backdrop-filter: blur(8px);
}

.admin-mutation-dialog {
  display: grid;
  width: min(100%, 520px);
  max-height: calc(100vh - 32px);
  gap: 16px;
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  background: rgb(12, 18, 31);
  padding: 20px;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.45);
}

.admin-mutation-control {
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  padding: 9px 11px;
  color: white;
}

.admin-mutation-secondary,
.admin-mutation-primary {
  border-radius: 10px;
  padding: 8px 13px;
  font-size: 12px;
}

.admin-mutation-secondary { background: rgba(255, 255, 255, 0.07); color: rgba(255, 255, 255, 0.72); }
.admin-mutation-primary { background: rgba(34, 211, 238, 0.18); color: rgb(207, 250, 254); }
</style>
