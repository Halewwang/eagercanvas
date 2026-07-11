<template>
  <div v-if="state.status !== 'ready'" class="canvas-project-loader">
    <div v-if="state.status === 'loading'" class="loader-card" role="status" aria-live="polite">
      <span class="spinner" aria-hidden="true" />
      <strong>Opening project</strong>
      <span>Preparing your canvas and latest saved work.</span>
    </div>
    <div v-else class="loader-card" role="alert">
      <strong>Project could not be opened</strong>
      <span>{{ state.error || 'The project is temporarily unavailable.' }}</span>
      <div class="actions">
        <button type="button" @click="$emit('retry')">Retry</button>
        <button type="button" class="secondary" @click="$emit('back')">Back to workspace</button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  state: {
    type: Object,
    default: () => ({ status: 'ready', projectId: '', error: '' })
  }
})
defineEmits(['retry', 'back'])
</script>

<style scoped>
.canvas-project-loader { position:absolute; inset:0; z-index:80; display:grid; place-items:center; background:rgba(8,8,8,.78); backdrop-filter:blur(8px); }
.loader-card { width:min(360px,calc(100vw - 40px)); display:flex; flex-direction:column; align-items:center; gap:10px; padding:24px; border-radius:16px; color:rgba(255,255,255,.92); background:rgba(22,23,26,.96); box-shadow:0 0 0 1px rgba(255,255,255,.1),0 18px 48px rgba(0,0,0,.28); text-align:center; }
.loader-card > span:not(.spinner) { color:rgba(255,255,255,.62); font-size:12px; line-height:1.5; }
.spinner { width:24px; height:24px; border-radius:999px; box-shadow:inset 0 0 0 2px rgba(255,255,255,.18); border-top:2px solid rgba(255,255,255,.92); animation:loader-spin .8s linear infinite; }
.actions { display:flex; gap:8px; margin-top:6px; }
.actions button { height:34px; padding:0 13px; border:0; border-radius:8px; color:#0d0e10; background:#fff; cursor:pointer; }
.actions button.secondary { color:rgba(255,255,255,.82); background:rgba(255,255,255,.08); box-shadow:inset 0 0 0 1px rgba(255,255,255,.1); }
@keyframes loader-spin { to { transform:rotate(360deg); } }
@media (prefers-reduced-motion:reduce) { .spinner { animation:none; } }
</style>
