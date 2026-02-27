/**
 * Theme store
 * Dark mode only.
 */
import { ref, watchEffect } from 'vue'

export const isDark = ref(true)

watchEffect(() => {
  document.documentElement.classList.add('dark')
})
