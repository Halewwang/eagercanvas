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

          <div class="home-topbar-actions">
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
              <svg viewBox="0 0 13 13" fill="none" aria-hidden="true" class="home-tab-icon">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M10 1.5H3.00005C2.17162 1.5 1.50005 2.17157 1.50005 3V8.02717L2.46161 7.32786C3.08293 6.87599 3.9263 6.88219 4.54091 7.34314L5.46874 8.03902L7.83653 6.00948C8.51048 5.43181 9.51016 5.45021 10.1624 6.05228L11.5 7.28701V3C11.5 2.17157 10.8285 1.5 10 1.5ZM13 8.99781V3C13 1.34315 11.6569 0 10 0H3.00005C1.3432 0 5.29014e-05 1.34315 5.29014e-05 3V9.49169C-1.75988e-05 9.49764 -1.76687e-05 9.50359 5.29014e-05 9.50954V10C5.29014e-05 11.6569 1.3432 13 3.00005 13H10C11.6569 13 13 11.6569 13 10V9.00257V8.99781ZM11.5 9.32837L9.14498 7.15448C9.05181 7.06847 8.90899 7.06584 8.81272 7.14837L5.98814 9.56944L5.53135 9.96098L5.05005 9.6L3.64091 8.54315C3.55311 8.47729 3.43262 8.47641 3.34386 8.54096L1.50005 9.88192V10C1.50005 10.8284 2.17162 11.5 3.00005 11.5H10C10.8285 11.5 11.5 10.8284 11.5 10V9.32837ZM6.00004 4.5C6.00004 5.32843 5.32847 6 4.50005 6C3.67162 6 3.00005 5.32843 3.00005 4.5C3.00005 3.67157 3.67162 3 4.50005 3C5.32847 3 6.00004 3.67157 6.00004 4.5Z" fill="currentColor"/>
              </svg>
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
              <svg viewBox="0 0 16 10" fill="none" aria-hidden="true" class="home-tab-icon">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M3 1.5H8.5C9.32843 1.5 10 2.17157 10 3V3.5V6.5V7C10 7.82843 9.32843 8.5 8.5 8.5H3C2.17157 8.5 1.5 7.82843 1.5 7V3C1.5 2.17157 2.17157 1.5 3 1.5ZM11.452 7.53717C11.1989 8.9377 9.97349 10 8.5 10H3C1.34315 10 0 8.65685 0 7V3C0 1.34315 1.34315 0 3 0H8.5C9.97349 0 11.1989 1.0623 11.452 2.46283L13.0063 1.35265C13.3274 1.1233 13.7121 1 14.1067 1C15.1524 1 16 1.84765 16 2.89327V7.10673C16 8.15235 15.1524 9 14.1067 9C13.7121 9 13.3274 8.8767 13.0063 8.64735L11.452 7.53717ZM11.5 5.72807L13.8781 7.42675C13.9448 7.47439 14.0248 7.5 14.1067 7.5C14.3239 7.5 14.5 7.32393 14.5 7.10673V2.89327C14.5 2.67607 14.3239 2.5 14.1067 2.5C14.0248 2.5 13.9448 2.52561 13.8781 2.57325L11.5 4.27193V5.72807Z" fill="currentColor"/>
              </svg>
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
              <svg viewBox="0 0 14 14.2502" fill="none" aria-hidden="true" class="home-tab-icon">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M3 1.5H11C11.8284 1.5 12.5 2.17157 12.5 3V3.5L1.5 3.5V3C1.5 2.17157 2.17157 1.5 3 1.5ZM12.5 6.75V5L1.5 5V8.5C1.5 9.32843 2.17157 10 3 10H5.75C6.16421 10 6.5 10.3358 6.5 10.75C6.5 11.1642 6.16421 11.5 5.75 11.5H3C1.34315 11.5 0 10.1569 0 8.5V3C0 1.34315 1.34315 0 3 0H11C12.6569 0 14 1.34315 14 3V6.75C14 7.16421 13.6642 7.5 13.25 7.5C12.8358 7.5 12.5 7.16421 12.5 6.75ZM9.22766 6.67179C9.00375 6.48682 8.69317 6.44775 8.43043 6.5715C8.16768 6.69525 8 6.95958 8 7.25001V12.7935C8 13.1119 8.201 13.3955 8.50136 13.5011C8.80172 13.6066 9.13598 13.511 9.33514 13.2627L10.2329 12.1429L11.0792 13.8354C11.2644 14.2059 11.7149 14.3561 12.0854 14.1708C12.4559 13.9856 12.6061 13.5351 12.4208 13.1646L11.594 11.5109H13C13.3164 11.5109 13.5987 11.3124 13.7058 11.0147C13.8128 10.717 13.7216 10.3841 13.4777 10.1827L9.22766 6.67179Z" fill="currentColor"/>
              </svg>
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
              <span class="home-model-icon home-model-icon-mask" :style="moduleMaskedIconStyle" aria-hidden="true" />
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
              <span class="home-model-icon home-model-icon-mask" :style="moduleMaskedIconStyle" aria-hidden="true" />
              <img :src="videoModuleSecondaryIcon" alt="" class="home-model-icon home-model-icon-video-secondary" />
            </div>
          </div>
        </section>

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
              <img :src="model3dModuleIcon" alt="" class="home-model-icon home-model-icon-3d" />
            </div>
          </div>

          <div class="home-3d-panel">
            <img :src="model3dLeft" alt="3D module preview" class="home-3d-panel-left" />
            <img :src="model3dRight" alt="3D module alternate preview" class="home-3d-panel-right" />
          </div>
        </section>

        <div class="home-section-rule home-section-rule-image" />
        <div class="home-section-rule home-section-rule-video" />
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
import { ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AuthDialog from '../components/AuthDialog.vue'
import imagePanelLeft from '@/assets/home-figma/hero-panel-left.png'
import imagePanelRight from '@/assets/home-figma/hero-panel-right.png'
import videoLarge from '@/assets/home-figma/video-large.png'
import videoTopRight from '@/assets/home-figma/video-top-right.png'
import videoBottomLeft from '@/assets/home-figma/video-bottom-left.png'
import videoBottomRight from '@/assets/home-figma/video-bottom-right.png'
import model3dLeft from '@/assets/home-figma/model3d-left.png'
import model3dRight from '@/assets/home-figma/model3d-right.png'
import aioncraftWordmark from '@/assets/home-figma/aioncraft-wordmark.svg'
import row02 from '@/assets/home-figma/row-02.svg'
import row03 from '@/assets/home-figma/row-03.svg'
import row04 from '@/assets/home-figma/row-04.svg'
import row05 from '@/assets/home-figma/row-05.svg'
import row06 from '@/assets/home-figma/row-06.svg'
import row07 from '@/assets/home-figma/row-07.svg'
import row08 from '@/assets/home-figma/row-08.svg'
import row09 from '@/assets/home-figma/row-09.svg'
import row10 from '@/assets/home-figma/row-10.svg'
import row11 from '@/assets/home-figma/row-11.svg'
import row12 from '@/assets/home-figma/row-12.svg'
import row13 from '@/assets/home-figma/row-13.svg'
import row14 from '@/assets/home-figma/row-14.svg'

const figmaStripMask = 'https://www.figma.com/api/mcp/asset/c2e7515e-9970-4973-8b0b-7c5992cf1824'
const figmaStripFill = 'https://www.figma.com/api/mcp/asset/4a14f4c9-dd6b-4ca1-9749-4467b4a42855'
const moduleIconMask = 'https://www.figma.com/api/mcp/asset/64008624-09d3-4dc9-8baa-d5c702fdd0b4'
const moduleIconFill = 'https://www.figma.com/api/mcp/asset/a8dfbdb0-3c2f-48be-b96e-78a9433c6b53'
const videoModuleSecondaryIcon = 'https://www.figma.com/api/mcp/asset/43889a84-876f-41b2-bcab-4dca91354bdc'
const model3dModuleIcon = 'https://www.figma.com/api/mcp/asset/fc920a90-f6d5-43ac-be50-6409bae4553e'

const buildMaskedStripIcon = () => ({
  kind: 'mask',
  style: {
    maskImage: `url(${figmaStripMask})`,
    WebkitMaskImage: `url(${figmaStripMask})`,
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
    maskPosition: 'center',
    WebkitMaskPosition: 'center',
    maskSize: '30px 30px',
    WebkitMaskSize: '30px 30px',
    backgroundImage: `url(${figmaStripFill})`,
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'cover'
  }
})

const moduleMaskedIconStyle = {
  maskImage: `url(${moduleIconMask})`,
  WebkitMaskImage: `url(${moduleIconMask})`,
  maskRepeat: 'no-repeat',
  WebkitMaskRepeat: 'no-repeat',
  maskPosition: 'center',
  WebkitMaskPosition: 'center',
  maskSize: '20px 20px',
  WebkitMaskSize: '20px 20px',
  backgroundImage: `url(${moduleIconFill})`,
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  backgroundSize: 'cover'
}

const stripIcons = [
  { kind: 'image', src: 'https://www.figma.com/api/mcp/asset/a6429337-b8de-4a77-b863-b5f662b90a1e' },
  { kind: 'image', src: 'https://www.figma.com/api/mcp/asset/7d905930-aa1e-488d-9014-5dd9046cf586' },
  { kind: 'image', src: 'https://www.figma.com/api/mcp/asset/02aae844-d58b-4950-8733-1b2eec15b57a' },
  { kind: 'image', src: 'https://www.figma.com/api/mcp/asset/854ba0f3-4e42-49b0-8b61-dc4dd795ab80' },
  { kind: 'image', src: 'https://www.figma.com/api/mcp/asset/86ea12ea-60f4-4169-9b19-fffe5617cd24' },
  { kind: 'image', src: 'https://www.figma.com/api/mcp/asset/35d1396f-5f99-4adb-87d0-bdcd2df300ea' },
  { kind: 'image', src: 'https://www.figma.com/api/mcp/asset/63e8101d-7f08-47f6-9b28-ea184992f998' },
  buildMaskedStripIcon(),
  { kind: 'image', src: 'https://www.figma.com/api/mcp/asset/12dc8538-8cab-4d2d-9ac9-97e0f90c659f' },
  { kind: 'image', src: 'https://www.figma.com/api/mcp/asset/a6429337-b8de-4a77-b863-b5f662b90a1e' },
  { kind: 'image', src: 'https://www.figma.com/api/mcp/asset/7d905930-aa1e-488d-9014-5dd9046cf586' },
  { kind: 'image', src: 'https://www.figma.com/api/mcp/asset/02aae844-d58b-4950-8733-1b2eec15b57a' },
  { kind: 'image', src: 'https://www.figma.com/api/mcp/asset/854ba0f3-4e42-49b0-8b61-dc4dd795ab80' },
  { kind: 'image', src: 'https://www.figma.com/api/mcp/asset/86ea12ea-60f4-4169-9b19-fffe5617cd24' },
  { kind: 'image', src: 'https://www.figma.com/api/mcp/asset/d67321ab-4c94-42e6-b24c-9f19ba4c0ce5' },
  { kind: 'image', src: 'https://www.figma.com/api/mcp/asset/63e8101d-7f08-47f6-9b28-ea184992f998' },
  buildMaskedStripIcon()
]

const router = useRouter()
const route = useRoute()
const { isAuthenticated, bootstrapAuth } = useAuthStore()

const authModalVisible = ref(false)
const authMode = ref('login')

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

<style scoped>
.home-shell {
  min-width: 1440px;
  overflow-x: hidden;
  background: #010101;
}

.home-canvas {
  display: flex;
  justify-content: center;
  min-width: 1440px;
}

.home-artboard {
  position: relative;
  width: 1440px;
  height: 2736px;
  overflow: visible;
  background: #010101;
  color: #ffffff;
  font-family: 'fieldwork', sans-serif;
}

.home-hero-media {
  position: absolute;
  left: 50%;
  top: 0;
  width: 100vw;
  min-width: 1440px;
  height: 768px;
  transform: translateX(-50%);
}

.home-bg-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  filter: grayscale(1) brightness(0.76) contrast(1.04);
}

.home-hero-overlay {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(7, 8, 10, 0.08) 0%, rgba(7, 8, 10, 0.02) 34%, rgba(7, 8, 10, 0.12) 70%, rgba(7, 8, 10, 0.22) 100%),
    linear-gradient(90deg, rgba(0, 0, 0, 0.14) 0%, rgba(0, 0, 0, 0) 15%, rgba(0, 0, 0, 0) 85%, rgba(0, 0, 0, 0.14) 100%);
}

.home-hero-shadow {
  position: absolute;
  left: 50%;
  top: 236px;
  width: 100vw;
  min-width: 1440px;
  height: 532px;
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0) 0%,
    rgba(0, 0, 0, 0.1) 24%,
    rgba(0, 0, 0, 0.34) 52%,
    rgba(0, 0, 0, 0.76) 82%,
    rgba(0, 0, 0, 1) 100%
  );
  transform: translateX(-50%);
}

.home-body-plane {
  position: absolute;
  left: 50%;
  top: 768px;
  width: 100vw;
  min-width: 1440px;
  height: 1968px;
  background: #010101;
  transform: translateX(-50%);
}

.home-body-grid {
  position: absolute;
  left: 50%;
  top: 768px;
  width: 100vw;
  min-width: 1440px;
  height: 1968px;
  background-image: radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px);
  background-size: 18px 18px;
  background-position: top center;
  transform: translateX(-50%);
}

.home-topbar {
  position: absolute;
  left: 243px;
  top: 38px;
  width: 954px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 2;
}

.home-brand {
  display: inline-flex;
  align-items: center;
  border: none;
  padding: 0;
  background: transparent;
  color: #ffffff;
}

.home-brand-image {
  width: 93px;
  height: 31px;
  display: block;
}

.home-topbar-actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.home-topbar-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 32px;
  padding: 6px 10px;
  border-radius: 16px;
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  border: none;
}

.home-topbar-button-register {
  background: rgba(255, 255, 255, 0.96);
  color: #fcfcfc;
  color: #111319;
}

.home-topbar-button-login {
  background: #000000;
  color: #fcfcfc;
}

.home-inline-icon {
  width: 16px;
  height: 16px;
  display: block;
  flex: 0 0 auto;
}

.home-inline-icon-sm {
  width: 14px;
  height: 14px;
}

.home-hero {
  position: absolute;
  left: 508px;
  top: 281px;
  width: 425px;
  text-align: center;
  z-index: 2;
}

.home-hero-line {
  width: 198px;
  height: 21px;
  margin: 0 auto 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 39px;
  border: 0.5px solid rgba(255, 255, 255, 0.75);
}

.home-hero-line-text {
  color: #ffffff;
  font-size: 10px;
  font-weight: 300;
  line-height: 24px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.home-hero-title {
  margin: 0;
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
  white-space: nowrap;
}

.home-hero-title-main {
  font-size: 36px;
  font-weight: 300;
  line-height: 58px;
}

.home-hero-title-script {
  font-family: 'Sacramento', cursive;
  font-size: 37px;
  line-height: 58px;
}

.home-hero-copy {
  margin: 8px 0 0;
  color: rgba(255, 255, 255, 0.5);
  font-size: 16px;
  font-weight: 300;
  line-height: 18px;
  letter-spacing: 0;
}

.home-hero-actions {
  width: 305px;
  margin: 44px auto 0;
  display: flex;
  justify-content: space-between;
}

.home-hero-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 36px;
  padding: 8px 14px;
  border-radius: 24px;
  font-family: 'Inter', sans-serif;
  font-weight: 500;
  border: none;
}

.home-hero-button-primary {
  width: 141px;
  background: #18181b;
  color: #ebebec;
  font-size: 16px;
  line-height: 24px;
}

.home-hero-button-secondary {
  width: 138px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: transparent;
  color: #fcfcfc;
  font-size: 14px;
  line-height: 20px;
}

.home-credit {
  position: absolute;
  left: 634px;
  top: 712px;
  margin: 0;
  color: rgba(255, 255, 255, 0.32);
  font-size: 10px;
  line-height: 24px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  z-index: 2;
}

.home-logo-strip {
  position: absolute;
  left: 73px;
  top: 849px;
  width: 1294px;
  overflow: hidden;
  z-index: 2;
}

.home-logo-strip-track {
  display: flex;
  width: max-content;
  animation: home-logo-marquee 26s linear infinite;
}

.home-logo-strip-group {
  width: 1294px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 0 0 auto;
}

.home-logo-strip-item {
  width: 30px;
  height: 30px;
  object-fit: contain;
  display: block;
  flex: 0 0 auto;
}

.home-logo-strip-item-mask {
  display: block;
}

.home-overview {
  position: absolute;
  left: 242px;
  top: 995px;
  width: 361px;
  text-align: left;
  z-index: 2;
}

.home-overview-label {
  margin: 0;
  color: #ffffff;
  font-size: 16px;
  font-weight: 400;
  line-height: 24px;
}

.home-overview-title {
  margin: 15px 0 0;
  display: flex;
  flex-direction: column;
  color: #ffffff;
  font-size: 36px;
  font-weight: 400;
  line-height: 35px;
}

.home-support-copy {
  position: absolute;
  left: 852px;
  top: 1007px;
  width: 348px;
  margin: 0;
  text-align: left;
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
  line-height: 20px;
  letter-spacing: 0.05em;
  z-index: 2;
}

.home-tabs {
  position: absolute;
  left: 242px;
  top: 1181px;
  width: 955px;
  display: grid;
  grid-template-columns: 225px 224px 224px;
  column-gap: 141px;
  z-index: 2;
}

.home-tabs-rule {
  position: absolute;
  left: 0;
  top: 0;
  width: 955px;
  height: 1px;
  background: rgba(255, 255, 255, 0.16);
}

.home-tab {
  position: relative;
  height: 153px;
}

.home-tab-pill {
  position: absolute;
  left: -10px;
  top: 51px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 32px;
  padding: 6px 10px;
  border-radius: 16px;
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  color: #fcfcfc;
}

.home-tab-icon {
  width: 16px;
  height: 16px;
  display: block;
  flex: 0 0 auto;
}

.home-tab-copy {
  position: absolute;
  left: 0;
  top: 113px;
  margin: 0;
  text-align: left;
  color: rgba(255, 255, 255, 0.88);
  font-size: 14px;
  font-weight: 300;
  line-height: 20px;
  letter-spacing: 0.05em;
}

.home-tab-line {
  position: absolute;
  left: 0;
  top: 97px;
  width: 100%;
  height: 1px;
  background: rgba(255, 255, 255, 0.16);
}

.home-module {
  position: absolute;
  z-index: 2;
}

.home-module-image {
  left: 242px;
  top: 1426px;
  width: 955px;
  display: grid;
  grid-template-columns: 346px 589px;
  column-gap: 20px;
}

.home-module-video {
  left: 242px;
  top: 1861px;
  width: 955px;
  display: grid;
  grid-template-columns: 590px 272px;
  column-gap: 21px;
}

.home-module-3d {
  left: 242px;
  top: 2298px;
  width: 955px;
  display: grid;
  grid-template-columns: 346px 587px;
  column-gap: 22px;
}

.home-module-copy-panel {
  width: 272px;
  display: flex;
  flex-direction: column;
  text-align: left;
}

.home-module-copy-panel-right {
  margin-left: 11px;
}

.home-module-label {
  margin: 0;
  color: rgba(255, 255, 255, 0.32);
  font-size: 13px;
  line-height: 24px;
  letter-spacing: 0;
  text-align: left;
}

.home-module-title {
  margin: 21px 0 0;
  display: flex;
  flex-direction: column;
  color: #ffffff;
  font-size: 24px;
  font-weight: 400;
  line-height: 24px;
  text-align: left;
}

.home-module-description {
  margin: 21px 0 0;
  color: rgba(255, 255, 255, 0.5);
  font-size: 11px;
  line-height: 15px;
  text-align: left;
}

.home-module-list {
  margin: 21px 0 0;
  padding-left: 0;
  list-style: none;
  color: rgba(255, 255, 255, 0.5);
  font-size: 11px;
  line-height: 15px;
  text-align: left;
}

.home-module-list li {
  position: relative;
  padding-left: 14px;
  margin-bottom: 4px;
}

.home-module-list li::before {
  content: '·';
  position: absolute;
  left: 0;
  top: 0;
  color: rgba(255, 255, 255, 0.5);
}

.home-model-icons {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 21px;
  justify-content: flex-start;
}

.home-model-icons-multi {
  gap: 8px;
}

.home-model-icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
  display: block;
}

.home-model-icon-mask {
  flex: 0 0 auto;
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
}

.home-model-icon-video-secondary {
  width: 20px;
  height: 18px;
  flex: 0 0 auto;
}

.home-model-icon-3d {
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
}

.home-image-panel {
  position: relative;
  width: 589px;
  height: 350px;
  border-radius: 15px;
  background: #191919;
}

.home-image-panel-left {
  position: absolute;
  left: 8px;
  top: 9px;
  width: 263px;
  height: 209px;
  border-radius: 15px;
  object-fit: cover;
}

.home-image-panel-right {
  position: absolute;
  left: 280px;
  top: 9px;
  width: 301px;
  height: 208px;
  border-radius: 15px;
  object-fit: cover;
}

.home-image-panel-caption {
  position: absolute;
  left: 8px;
  top: 229px;
  width: 573px;
  height: 111px;
  border-radius: 15px;
  background: #010101;
  color: #7b7b7b;
  font-size: 13px;
  line-height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0 32px;
  box-sizing: border-box;
}

.home-video-panel {
  position: relative;
  width: 590px;
  height: 350px;
}

.home-video-large {
  position: absolute;
  left: 0;
  top: 0;
  width: 346px;
  height: 350px;
  border-radius: 15px;
  object-fit: cover;
}

.home-video-top-right {
  position: absolute;
  left: 366px;
  top: 0;
  width: 224px;
  height: 169px;
  border-radius: 15px;
  object-fit: cover;
}

.home-video-bottom-left {
  position: absolute;
  left: 366px;
  top: 187px;
  width: 123px;
  height: 164px;
  border-radius: 15px;
  object-fit: cover;
}

.home-video-bottom-right {
  position: absolute;
  left: 505px;
  top: 187px;
  width: 85px;
  height: 164px;
  border-radius: 15px;
  object-fit: cover;
}

.home-3d-panel {
  position: relative;
  width: 587px;
  height: 350px;
}

.home-3d-panel-left {
  position: absolute;
  left: 0;
  top: 0;
  width: 222px;
  height: 350px;
  border-radius: 25px;
  object-fit: cover;
}

.home-3d-panel-right {
  position: absolute;
  left: 242px;
  top: 0;
  width: 345px;
  height: 350px;
  border-radius: 25px;
  object-fit: cover;
}

.home-section-rule {
  position: absolute;
  height: 1px;
  background: rgba(255, 255, 255, 0.16);
  z-index: 2;
}

.home-section-rule-image {
  left: 242px;
  top: 1774px;
  width: 346px;
}

.home-section-rule-video {
  left: 851px;
  top: 2212px;
  width: 346px;
}

.home-section-rule-3d {
  left: 243px;
  top: 2647px;
  width: 345px;
}

@keyframes home-logo-marquee {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-1294px);
  }
}
</style>
