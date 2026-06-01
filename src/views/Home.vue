<template>
  <div class="home-shell">
    <div class="home-canvas">
      <div class="home-artboard">
        <div class="home-hero-media">
          <video class="home-bg-video" autoplay muted loop playsinline preload="metadata">
            <source src="/home-bg-loop.mp4" type="video/mp4" />
          </video>
          <div class="home-hero-overlay" />
        </div>

        <div class="home-body-plane" />
        <div class="home-body-grid" />
        <div class="home-hero-shadow" />

        <header class="home-topbar">
          <button type="button" class="home-brand" @click="scrollToTop">
            <img :src="aioncraftWordmark" alt="AionCraft" class="home-brand-image" />
          </button>

          <nav class="home-topbar-nav" aria-label="Primary">
            <button type="button" class="home-topbar-link" @click="scrollToTop">Home</button>
            <button type="button" class="home-topbar-link" @click="openEditorSpace">Editor</button>
            <button type="button" class="home-topbar-link" @click="openCutSpace">Cut</button>
          </nav>

          <div v-if="isAuthenticated" class="home-topbar-actions home-topbar-actions-authenticated">
            <div class="home-topbar-avatar" aria-hidden="true">
              <img v-if="user?.avatarUrl" :src="user.avatarUrl" alt="" class="home-topbar-avatar-image" />
              <span v-else class="home-topbar-avatar-fallback">{{ avatarInitial }}</span>
            </div>
            <button type="button" class="home-topbar-button home-topbar-button-logout" @click="handleLogout">
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" class="home-inline-icon">
                <path d="M6.5 2.75H4.25C3.83579 2.75 3.5 3.08579 3.5 3.5V12.5C3.5 12.9142 3.83579 13.25 4.25 13.25H6.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M9.75 5.25L12.5 8L9.75 10.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M12.25 8H6.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              <span>Logout</span>
            </button>
          </div>
          <div v-else class="home-topbar-actions">
            <button type="button" class="home-topbar-button home-topbar-button-register" @click="openRegister">
              <svg viewBox="0 0 14.75 14" fill="none" aria-hidden="true" class="home-inline-icon">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M7 5.5C8.10457 5.5 9 4.60457 9 3.5C9 2.39543 8.10457 1.5 7 1.5C5.89543 1.5 5 2.39543 5 3.5C5 4.60457 5.89543 5.5 7 5.5ZM7 7C8.933 7 10.5 5.433 10.5 3.5C10.5 1.567 8.933 0 7 0C5.067 0 3.5 1.567 3.5 3.5C3.5 5.433 5.067 7 7 7ZM8 8.22517C8 7.84009 7.70631 7.5158 7.32139 7.50465C7.21485 7.50156 7.1077 7.5 7 7.5C3.15 7.5 0 9.5 0 11.5C0 12.8807 1.11929 14 2.5 14H11.25C11.6642 14 12 13.6642 12 13.25C12 12.8358 11.6642 12.5 11.25 12.5H2.5C1.94772 12.5 1.5 12.0523 1.5 11.5C1.5 11.2955 1.72027 10.6911 2.81956 10.0413C3.83752 9.43951 5.31979 9 7 9C7.05845 9 7.11666 9.00053 7.17462 9.00158C7.61664 9.00961 8 8.66727 8 8.22517ZM12.75 7C12.75 6.58579 12.4142 6.25 12 6.25C11.5858 6.25 11.25 6.58579 11.25 7V8.25H10C9.58579 8.25 9.25 8.58579 9.25 9C9.25 9.41421 9.58579 9.75 10 9.75H11.25V11C11.25 11.4142 11.5858 11.75 12 11.75C12.4142 11.75 12.75 11.4142 12.75 11V9.75H14C14.4142 9.75 14.75 9.41421 14.75 9C14.75 8.58579 14.4142 8.25 14 8.25H12.75V7Z" fill="currentColor"/>
              </svg>
              <span>Register</span>
            </button>
            <button type="button" class="home-topbar-button home-topbar-button-login" @click="openLogin">
              <svg viewBox="0 0 14 14" fill="none" aria-hidden="true" class="home-inline-icon">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M8.20785 11.3458C7.72302 12.3463 7.25486 12.5 7 12.5C6.74514 12.5 6.27698 12.3463 5.79215 11.3458C5.41987 10.5776 5.14494 9.48773 5.04314 8.15864C5.67634 8.21865 6.33101 8.24997 7 8.24997C7.66899 8.24997 8.32366 8.21865 8.95686 8.15864C8.85506 9.48773 8.58013 10.5776 8.20785 11.3458ZM8.99615 6.6473C8.35796 6.71422 7.68967 6.74997 7 6.74997C6.31033 6.74997 5.64204 6.71422 5.00385 6.6473C5.04121 4.95052 5.34713 3.57247 5.79215 2.65416C6.27698 1.65372 6.74514 1.5 7 1.5C7.25486 1.5 7.72302 1.65372 8.20785 2.65416C8.65287 3.57247 8.95879 4.95052 8.99615 6.6473ZM10.4737 7.95347C10.3885 9.46853 10.0989 10.8012 9.63836 11.8271C11.216 10.9629 12.3237 9.34794 12.4808 7.46288C11.8595 7.66166 11.1863 7.82671 10.4737 7.95347ZM12.3919 5.9095C11.8199 6.11447 11.1813 6.28863 10.4905 6.42434C10.435 4.75296 10.1368 3.28328 9.63836 2.17295C11.0378 2.93948 12.0675 4.29687 12.3919 5.9095ZM3.50947 6.42434C3.56501 4.75296 3.86321 3.28328 4.36164 2.17295C2.96219 2.93948 1.93247 4.29687 1.6081 5.90951C2.18009 6.11448 2.81871 6.28863 3.50947 6.42434ZM1.5192 7.46288C1.67628 9.34794 2.78403 10.9629 4.36164 11.8271C3.90112 10.8012 3.61153 9.46853 3.52633 7.95347C2.81369 7.82671 2.14052 7.66166 1.5192 7.46288ZM14 7C14 3.13401 10.866 0 7 0C3.13401 0 0 3.13401 0 7C0 10.866 3.13401 14 7 14C10.866 14 14 10.866 14 7Z" fill="currentColor"/>
              </svg>
              <span>Login</span>
            </button>
          </div>
        </header>

        <section class="home-hero">
          <div class="home-hero-line">
            <span class="home-hero-line-text">Infinite Creative Workspace</span>
          </div>

          <h1 class="home-hero-title">
            <span class="home-hero-title-main">Ling's Visuals</span>
            <span class="home-hero-title-script">Canvas</span>
          </h1>

          <p class="home-hero-copy">
            Orchestrate your creative workflows on an infinite canvas.
            <br />
            From prompt to masterpiece in seconds.
          </p>

          <div class="home-hero-actions">
            <button type="button" class="home-hero-button home-hero-button-primary" @click="handleGetStarted">
              <svg viewBox="0 0 13 13" fill="none" aria-hidden="true" class="home-inline-icon home-inline-icon-sm">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M10 1.5H3C2.17157 1.5 1.5 2.17157 1.5 3V10C1.5 10.8284 2.17157 11.5 3 11.5H10C10.8284 11.5 11.5 10.8284 11.5 10V3C11.5 2.17157 10.8284 1.5 10 1.5ZM3 0C1.34315 0 0 1.34315 0 3V10C0 11.6569 1.34315 13 3 13H10C11.6569 13 13 11.6569 13 10V3C13 1.34315 11.6569 0 10 0H3ZM9 6H3.93005C3.37777 6 2.93005 6.44771 2.93005 7V9.00003C2.93005 9.55231 3.37777 10 3.93005 10H9C9.55228 10 10 9.55231 10 9.00003V7C10 6.44772 9.55228 6 9 6ZM3.68005 3H7.25C7.66421 3 8 3.33579 8 3.75C8 4.16421 7.66421 4.5 7.25 4.5H3.68005C3.26584 4.5 2.93005 4.16421 2.93005 3.75C2.93005 3.33579 3.26584 3 3.68005 3Z" fill="currentColor"/>
              </svg>
              <span>Get Started</span>
            </button>
            <button type="button" class="home-hero-button home-hero-button-secondary" @click="openEditorSpace">
              <svg viewBox="0 0 15.3713 14.9376" fill="none" aria-hidden="true" class="home-inline-icon home-inline-icon-sm">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M6.06478 5.68759L3.87134 1.76248L1.6779 5.68759L6.06478 5.68759ZM4.96252 0.640222C4.48549 -0.213409 3.25719 -0.213407 2.78016 0.640224L0.160629 5.32781C-0.304989 6.16102 0.297324 7.18759 1.25181 7.18759L6.49088 7.18759C7.44536 7.18759 8.04767 6.16102 7.58206 5.32781L4.96252 0.640222ZM2.40571 14.6169C2.85154 14.8227 3.34803 14.9376 3.87134 14.9376C5.28102 14.9376 6.49606 14.1042 7.05062 12.9032C7.25649 12.4574 7.37134 11.9609 7.37134 11.4376C7.37134 9.50459 5.80434 7.93759 3.87134 7.93759C1.93835 7.93759 0.371342 9.50459 0.371342 11.4376C0.371342 12.8473 1.20474 14.0623 2.40571 14.6169ZM3.87134 13.4376C4.97591 13.4376 5.87134 12.5422 5.87134 11.4376C5.87134 10.333 4.97591 9.43759 3.87134 9.43759C2.76677 9.43759 1.87134 10.333 1.87134 11.4376C1.87134 12.5422 2.76677 13.4376 3.87134 13.4376ZM15.1517 0.907257C15.4446 1.20015 15.4446 1.67502 15.1517 1.96792L10.1517 6.96792C9.85878 7.26081 9.3839 7.26081 9.09101 6.96792C8.79812 6.67502 8.79812 6.20015 9.09101 5.90726L14.091 0.907257C14.3839 0.614364 14.8588 0.614364 15.1517 0.907257ZM10.1213 12.9376V9.43759H13.6213V12.9376H10.1213ZM8.62134 9.18759C8.62134 8.49723 9.18099 7.93759 9.87134 7.93759H13.8713C14.5617 7.93759 15.1213 8.49723 15.1213 9.18759V13.1876C15.1213 13.8779 14.5617 14.4376 13.8713 14.4376H9.87134C9.18099 14.4376 8.62134 13.8779 8.62134 13.1876V9.18759Z" fill="currentColor"/>
              </svg>
              <span>Editor Space</span>
            </button>
          </div>
        </section>

        <p class="home-credit">Developed by Eager Design</p>

        <section class="home-logo-strip" aria-label="creative stack">
          <div class="home-logo-strip-track">
            <div class="home-logo-strip-group">
              <template v-for="(logo, index) in stripIcons" :key="`primary-${index}`">
                <img
                  v-if="logo.kind === 'image'"
                  :src="logo.src"
                  alt=""
                  class="home-logo-strip-item"
                  loading="lazy"
                />
                <span
                  v-else
                  class="home-logo-strip-item home-logo-strip-item-mask"
                  :style="logo.style"
                  aria-hidden="true"
                />
              </template>
            </div>
            <div class="home-logo-strip-group" aria-hidden="true">
              <template v-for="(logo, index) in stripIcons" :key="`repeat-${index}`">
                <img
                  v-if="logo.kind === 'image'"
                  :src="logo.src"
                  alt=""
                  class="home-logo-strip-item"
                  loading="lazy"
                />
                <span
                  v-else
                  class="home-logo-strip-item home-logo-strip-item-mask"
                  :style="logo.style"
                  aria-hidden="true"
                />
              </template>
            </div>
          </div>
        </section>

        <section class="home-overview">
          <p class="home-overview-label">Creative Modules</p>
          <h2 class="home-overview-title">
            <span>Built for stills, motion,</span>
            <span>and 3D.</span>
          </h2>
        </section>

        <p class="home-support-copy">
          One canvas connects image generation, video creation, and 3D building in a single workspace. Inputs,
          outputs, and revisions stay close to the media they control.
        </p>

        <section class="home-tabs">
          <div class="home-tabs-rule" />
          <div class="home-tab home-tab-image">
            <div class="home-tab-pill">
              <img :src="tabImageIcon" alt="" class="home-tab-icon home-tab-icon-image" />
              <span>Image</span>
            </div>
            <p class="home-tab-copy">
              Prompt + reference +
              <br />
              1K / 2K / 4K
            </p>
            <div class="home-tab-line" />
          </div>

          <div class="home-tab home-tab-video">
            <div class="home-tab-pill">
              <img :src="tabVideoIcon" alt="" class="home-tab-icon home-tab-icon-image" />
              <span>Video</span>
            </div>
            <p class="home-tab-copy">
              Prompt + first / last frame +
              <br />
              short-form motion
            </p>
            <div class="home-tab-line" />
          </div>

          <div class="home-tab home-tab-3d">
            <div class="home-tab-pill">
              <img :src="module3dIcon" alt="" class="home-tab-icon home-tab-icon-image" />
              <span>3D</span>
            </div>
            <p class="home-tab-copy">
              Prompt or multi-view inputs to
              <br />
              interactive assets
            </p>
            <div class="home-tab-line" />
          </div>
        </section>

        <section class="home-module home-module-image">
          <div class="home-module-copy-panel">
            <p class="home-module-label">Image Module</p>
            <h2 class="home-module-title">
              <span>Prompt to</span>
              <span>polished stills</span>
            </h2>
            <p class="home-module-description">
              Generate from text or reference, then keep refining without leaving the canvas.
            </p>
            <ul class="home-module-list">
              <li>Reference image input</li>
              <li>Flexible ratios with 1K / 2K / 4K output</li>
              <li>Remove Background, Crop, and Multi-Angle tools</li>
            </ul>
            <div class="home-model-icons">
              <img :src="moduleImageModelIcon" alt="" class="home-model-icon" />
            </div>
          </div>

          <div class="home-image-panel">
            <img :src="imagePanelLeft" alt="Image module result" class="home-image-panel-left" />
            <img :src="imagePanelRight" alt="Image module variations" class="home-image-panel-right" />
            <div class="home-image-panel-caption">
              Each module has its own model stack, so fast ideation and richer output can live in the same system
              without leaving the canvas.
            </div>
          </div>
        </section>

        <section class="home-module home-module-video">
          <div class="home-video-panel">
            <img :src="videoLarge" alt="Video module key frame" class="home-video-large" />
            <img :src="videoTopRight" alt="Video module still frame" class="home-video-top-right" />
            <img :src="videoBottomLeft" alt="Video module motion study" class="home-video-bottom-left" />
            <img :src="videoBottomRight" alt="Video module final shot" class="home-video-bottom-right" />
          </div>

          <div class="home-module-copy-panel home-module-copy-panel-right">
            <p class="home-module-label">Video Module</p>
            <h2 class="home-module-title">
              <span>Short motion with</span>
              <span>tighter control</span>
            </h2>
            <p class="home-module-description">
              Build clips from prompt, first frame, last frame, and reference images with controls that stay close to
              the media.
            </p>
            <ul class="home-module-list">
              <li>First frame, last frame, and reference picture inputs</li>
              <li>Ratio, duration, and resolution control</li>
              <li>Audio toggle on supported models</li>
            </ul>
            <div class="home-model-icons home-model-icons-multi">
              <img :src="moduleImageModelIcon" alt="" class="home-model-icon" />
              <img :src="moduleVideoModelIcon" alt="" class="home-model-icon home-model-icon-video-secondary" />
            </div>
          </div>
        </section>

        <div class="home-section-rule home-section-rule-image" />
        <div class="home-section-rule home-section-rule-video" />

        <section class="home-module home-module-3d">
          <div class="home-module-copy-panel">
            <p class="home-module-label">3D Module</p>
            <h2 class="home-module-title">
              <span>Text and views into</span>
              <span>3D assets</span>
            </h2>
            <p class="home-module-description">
              Generate 3D directly from prompt or feed multiple views into the same module, then inspect and export
              from the canvas.
            </p>
            <ul class="home-module-list">
              <li>Text-only or multi-view image generation</li>
              <li>Generate type, face count, and material controls</li>
              <li>Preview and export GLB assets in place</li>
            </ul>
            <div class="home-model-icons">
              <img :src="module3dSecondaryIcon" alt="" class="home-model-icon" />
            </div>
          </div>

          <div class="home-3d-panel">
            <img :src="module3dLeft" alt="3D generated asset preview" class="home-3d-left" />
            <img :src="module3dRight" alt="3D abstract asset preview" class="home-3d-right" />
          </div>
        </section>

        <div class="home-section-rule home-section-rule-3d" />
      </div>
    </div>

    <AuthDialog
      v-model:show="authModalVisible"
      v-model:mode="authMode"
      @close="closeAuthModal"
      @success="handleAuthSuccess"
    />
  </div>
</template>

<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AuthDialog from '@/components/AuthDialog.vue'
import imagePanelLeft from '@/assets/home-figma/hero-panel-left.png'
import imagePanelRight from '@/assets/home-figma/hero-panel-right.png'
import videoLarge from '@/assets/home-figma/video-large.png'
import videoTopRight from '@/assets/home-figma/video-top-right.png'
import videoBottomLeft from '@/assets/home-figma/video-bottom-left.png'
import videoBottomRight from '@/assets/home-figma/video-bottom-right.png'
import module3dLeft from '@/assets/home-figma/3d-left.png'
import module3dRight from '@/assets/home-figma/3d-right.png'
import aioncraftWordmark from '@/assets/home-figma/aioncraft-wordmark.svg'
import row02 from '@/assets/home-figma/row-02.svg'
import row03 from '@/assets/home-figma/row-03.svg'
import row05 from '@/assets/home-figma/row-05.svg'
import row07 from '@/assets/home-figma/row-07.svg'
import row08 from '@/assets/home-figma/row-08.svg'
import row09 from '@/assets/home-figma/row-09.svg'
import row11 from '@/assets/home-figma/row-11.svg'
import row13 from '@/assets/home-figma/row-13.svg'
import tabImageIcon from '@/assets/home-figma/tab-image-icon.svg'
import tabVideoIcon from '@/assets/home-figma/tab-video-icon.svg'
import moduleImageModelIcon from '@/assets/home-figma/module-image-model-icon.svg'
import moduleVideoModelIcon from '@/assets/home-figma/module-video-model-icon.svg'
import module3dIcon from '@/assets/home-figma/icon-3d.svg'
import module3dSecondaryIcon from '@/assets/home-figma/3d-module-icon.svg'

const stripIconSet = [
  row02,
  row03,
  row05,
  row07,
  row08,
  row09,
  row11,
  row13
]

const stripIcons = [...stripIconSet, ...stripIconSet].map((src) => ({ kind: 'image', src }))

const router = useRouter()
const route = useRoute()
const { isAuthenticated, user, bootstrapAuth, logout } = useAuthStore()

const authModalVisible = ref(false)
const authMode = ref('login')
const avatarInitial = computed(() => (user.value?.displayName || user.value?.email || 'A').charAt(0).toUpperCase())

const openLogin = () => {
  authMode.value = 'login'
  authModalVisible.value = true
}

const openRegister = () => {
  authMode.value = 'register'
  authModalVisible.value = true
}

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

const openCutSpace = () => {
  window.open('https://cut.enbrand.space/projects', '_self')
}

const handleLogout = async () => {
  await logout()
  await router.replace('/')
}

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
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

<style scoped src="./Home.css"></style>
