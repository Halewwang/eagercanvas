<template>
  <fieldset class="admin-role-multi-select" :disabled="disabled">
    <legend class="sr-only">用户角色</legend>
    <BaseCheckbox
      v-for="role in roleOptions"
      :key="role.value"
      class="admin-role-option"
      :class="{
        'is-selected': selectedRoles.includes(role.value),
        'is-disabled': disabled || (role.value === 'super_admin' && !isSuperAdminOperator)
      }"
      :model-value="selectedRoles.includes(role.value)"
      :disabled="disabled || (role.value === 'super_admin' && !isSuperAdminOperator)"
      @update:model-value="toggleRole(role.value, $event)"
    >{{ role.label }}</BaseCheckbox>
  </fieldset>
</template>

<script setup>
import { computed } from 'vue'
import { BaseCheckbox } from '@/components/ui'

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
  if (props.disabled) return
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
  margin: 0;
  border: 0;
  padding: 0;
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
  cursor: pointer;
}

.admin-role-option.is-selected {
  border-color: rgba(255, 255, 255, 0.32);
  background: rgba(255, 255, 255, 0.09);
  color: white;
}

.admin-role-option:focus-within {
  outline: 2px solid rgba(255, 255, 255, 0.55);
  outline-offset: 2px;
}

.admin-role-option.is-disabled {
  cursor: not-allowed;
  opacity: 0.48;
}
</style>
