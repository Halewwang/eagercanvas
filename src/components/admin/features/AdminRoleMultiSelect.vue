<template>
  <fieldset class="admin-role-multi-select" :disabled="disabled">
    <legend class="sr-only">用户角色</legend>
    <label v-for="role in roleOptions" :key="role.value" class="admin-role-option">
      <input
        type="checkbox"
        :checked="selectedRoles.includes(role.value)"
        :disabled="disabled || (role.value === 'super_admin' && !isSuperAdminOperator)"
        @change="toggleRole(role.value, $event.target.checked)"
      >
      <span>{{ role.label }}</span>
    </label>
  </fieldset>
</template>

<script setup>
import { computed } from 'vue'

const FIXED_ROLE_CODES = ['super_admin', 'admin', 'ops', 'support', 'user']
const ROLE_LABELS = {
  super_admin: '超级管理员',
  admin: '管理员',
  ops: '运维',
  support: '客服',
  user: '普通用户'
}

const emit = defineEmits(['update:modelValue'])
const props = defineProps({
  disabled: { type: Boolean, default: false },
  isSuperAdminOperator: { type: Boolean, default: false },
  modelValue: { type: Array, default: () => ['user'] }
})

const roleOptions = FIXED_ROLE_CODES.map((value) => ({ value, label: ROLE_LABELS[value] }))
const selectedRoles = computed(() => {
  const selected = new Set(props.modelValue)
  return FIXED_ROLE_CODES.filter((role) => selected.has(role))
})

const toggleRole = (role, checked) => {
  if (role === 'super_admin' && !props.isSuperAdminOperator) return
  const next = new Set(selectedRoles.value)
  if (checked) next.add(role)
  else next.delete(role)
  const completeRoles = FIXED_ROLE_CODES.filter((item) => next.has(item))
  if (completeRoles.length) emit('update:modelValue', completeRoles)
}
</script>

<style scoped>
.admin-role-multi-select {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(112px, 1fr));
  gap: 8px;
  min-width: 0;
}

.admin-role-option {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 34px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 9px;
  padding: 6px 9px;
  color: rgba(255, 255, 255, 0.72);
  font-size: 12px;
}

.admin-role-option:has(input:checked) {
  border-color: rgba(103, 232, 249, 0.34);
  background: rgba(34, 211, 238, 0.08);
  color: white;
}

.admin-role-option:has(input:disabled) {
  cursor: not-allowed;
  opacity: 0.48;
}
</style>
