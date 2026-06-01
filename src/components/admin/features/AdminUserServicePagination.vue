<template>
  <div v-if="totalUserPages > 1" class="mt-5 flex flex-wrap items-center justify-end gap-2">
    <AdminMicroButton :disabled="userPage <= 1" @click="emit('set-user-page', userPage - 1)">上一页</AdminMicroButton>
    <AdminMicroButton
      v-for="page in visibleUserPages"
      :key="`user-page-${page}`"
      :active="page === userPage"
      @click="emit('set-user-page', page)"
    >
      {{ page }}
    </AdminMicroButton>
    <AdminMicroButton :disabled="userPage >= totalUserPages" @click="emit('set-user-page', userPage + 1)">下一页</AdminMicroButton>
  </div>
</template>

<script setup>
import AdminMicroButton from '@/components/admin/AdminMicroButton.vue'

const emit = defineEmits(['set-user-page'])

defineProps({
  totalUserPages: {
    type: Number,
    default: 1
  },
  userPage: {
    type: Number,
    default: 1
  },
  visibleUserPages: {
    type: Array,
    default: () => []
  }
})
</script>
