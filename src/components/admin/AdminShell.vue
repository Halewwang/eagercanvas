<template>
  <div :class="['admin-shell min-h-screen overflow-x-hidden px-3 py-4 md:px-6 md:py-6', shellClass]">
    <div :class="['admin-frame w-full rounded-[20px] border border-white/10', frameClass]">
      <div class="admin-layout relative">
        <slot name="sidebar" />

        <main :class="['admin-main w-full min-w-0 p-5 md:p-7 lg:pl-[260px]', mainClass]">
          <slot />
        </main>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  shellClass: {
    type: [String, Array, Object],
    default: ''
  },
  frameClass: {
    type: [String, Array, Object],
    default: ''
  },
  mainClass: {
    type: [String, Array, Object],
    default: ''
  }
})
</script>

<style scoped>
.admin-shell {
  background:
    radial-gradient(900px 420px at 16% -10%, rgba(255, 255, 255, 0.05), transparent 60%),
    radial-gradient(900px 420px at 88% -12%, rgba(255, 255, 255, 0.04), transparent 60%),
    linear-gradient(180deg, #0a0a0b 0%, #09090a 100%);
  font-family: 'Sora', 'Avenir Next', 'SF Pro Text', sans-serif;
}

.admin-frame {
  overflow: hidden;
  background: linear-gradient(180deg, #141416 0%, #101012 100%);
  box-shadow: 0 22px 80px rgba(0, 0, 0, 0.45);
}

.admin-main {
  min-width: 0;
  background: linear-gradient(180deg, rgba(18, 18, 20, 0.72) 0%, rgba(11, 11, 13, 0.84) 100%);
}
</style>
