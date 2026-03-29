<template>
  <!-- Home page | 首页 -->
  <div class="home-shell h-screen overflow-y-auto overflow-x-hidden bg-[var(--bg-primary)] text-[var(--text-primary)] selection:bg-[var(--accent-color)] selection:text-white font-['fieldwork']">
    <!-- Background Elements -->
    <div class="fixed inset-0 pointer-events-none overflow-hidden">
      <div class="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-[var(--accent-color)] opacity-[0.03] blur-[120px]" />
      <div class="absolute bottom-[-20%] left-[-10%] w-[800px] h-[800px] rounded-full bg-[var(--accent-color)] opacity-[0.02] blur-[150px]" />
      <!-- Subtle Grid -->
      <div class="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.2)_1px,transparent_1px)] [background-size:20px_20px] opacity-50" />
    </div>

    <!-- Main content -->
    <main class="relative z-10 max-w-[1400px] mx-auto px-6 pt-16 pb-8 md:pt-24 md:pb-12">

      <!-- Hero Section -->
      <section class="flex flex-col items-center text-center mb-32 md:mb-48 relative">
        <div class="home-logo-ring mb-8">
          <img src="/project-logo.svg" alt="Eager Canvas logo" class="w-24 h-24 md:w-28 md:h-28 rounded-full" />
        </div>

        <div class="inline-flex items-center px-3 py-1 mb-6 rounded-full border border-[var(--border-color)] bg-[var(--bg-secondary)]/50 backdrop-blur-sm">
          <span class="w-2 h-2 rounded-full bg-[var(--accent-color)] mr-2 animate-pulse"></span>
          <span class="text-xs font-medium tracking-wide uppercase text-[var(--text-secondary)]">Infinite Creative Workspace</span>
        </div>

        <h1 class="font-thin text-4xl md:text-6xl lg:text-7xl mb-8 tracking-tight leading-none text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60">
          Ling's Visuals <span class="font-normal text-[var(--accent-color)] font-['Sacramento'] ml-2">Canvas</span>
        </h1>
        
        <p class="max-w-2xl text-lg md:text-xl text-[var(--text-secondary)] font-light mb-12 leading-relaxed tracking-wide">
          Orchestrate your creative workflows on an infinite canvas. <br class="hidden md:block"/>
          From prompt to masterpiece in seconds.
        </p>

        <div class="w-full max-w-3xl relative group perspective-1000">
          <div class="relative flex flex-col md:flex-row items-center justify-center gap-4 md:gap-5">
            <button
              @click="handleGetStarted"
              class="home-entry-button"
            >
              Get Started
            </button>
            <button
              @click="openEditorSpace"
              class="home-entry-button"
            >
              Editor Space
            </button>
          </div>
        </div>
      </section>

      <footer class="mt-16 md:mt-20 pb-4 text-center">
        <p class="text-xs md:text-sm tracking-[0.16em] uppercase text-[var(--text-tertiary)]">
          Developed by Eager Design
        </p>
      </footer>
    </main>

    <AuthDialog
      v-model:show="authModalVisible"
      v-model:mode="authMode"
      @close="closeAuthModal"
      @success="handleAuthSuccess"
    />
  </div>
</template>

<script setup>
/**
 * Home view component | 首页视图组件
 * Landing page only. Project browsing lives in Workspace.
 */
import { ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AuthDialog from '../components/AuthDialog.vue'

const router = useRouter()
const route = useRoute()
const { isAuthenticated, bootstrapAuth } = useAuthStore()

const openLogin = () => {
  authMode.value = 'login'
  authModalVisible.value = true
}

const openRegister = () => {
  authMode.value = 'register'
  authModalVisible.value = true
}

const authModalVisible = ref(false)
const authMode = ref('login')

const closeAuthModal = () => {
  authModalVisible.value = false
  clearAuthQuery()
}

const handleAuthSuccess = async () => {
  const redirect =
    typeof route.query.redirect === 'string' && route.query.redirect
      ? route.query.redirect
      : '/workspace'

  authModalVisible.value = false
  await router.replace(redirect)
}

const openAuthByQuery = () => {
  const authQuery = String(route.query.auth || '')
  if (authQuery === 'login' || authQuery === 'register') {
    authMode.value = authQuery
    authModalVisible.value = true
  }
}

const clearAuthQuery = () => {
  const query = { ...route.query }
  delete query.auth
  delete query.redirect
  router.replace({ path: route.path, query })
}

const handleGetStarted = async () => {
  if (isAuthenticated.value) {
    await router.push('/workspace')
    return
  }
  openLogin()
}

const openEditorSpace = () => {
  window.open('https://editor.enbrand.space/', '_self')
}

onMounted(async () => {
  await bootstrapAuth()
  openAuthByQuery()
})

watch(
  () => route.query.auth,
  () => openAuthByQuery()
)
</script>

<style scoped>
.perspective-1000 {
  perspective: 1000px;
}

.home-entry-button {
  min-width: 190px;
  padding: 0.85rem 1.75rem;
  border: 1px solid rgba(255, 255, 255, 0.78);
  border-radius: 9999px;
  background: transparent;
  color: #ffffff;
  font-size: 0.95rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  transition:
    transform 0.25s ease,
    border-color 0.25s ease,
    background-color 0.25s ease,
    box-shadow 0.25s ease;
}

.home-entry-button:hover {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.96);
  box-shadow: 0 12px 28px rgba(255, 255, 255, 0.06);
}

.home-entry-button:first-child {
  background: #ffffff;
  color: #0d0e10;
}

.home-entry-button:first-child:hover {
  background: #ffffff;
  color: #0d0e10;
}

.home-entry-button:active {
  transform: translateY(0);
}

@media (max-width: 767px) {
  .home-entry-button {
    width: 100%;
    min-width: 0;
  }
}
</style>
