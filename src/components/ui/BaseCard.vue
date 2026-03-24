<template>
  <section class="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)]" v-bind="$attrs">
    <div v-if="$slots.header" class="border-b border-[var(--border)] px-5 py-4">
      <slot name="header" />
    </div>
    <div class="px-5 py-4">
      <slot />
    </div>
    <div v-if="$slots.footer" class="border-t border-[var(--border)] px-5 py-4">
      <slot name="footer" />
    </div>
  </section>
</template>

<script setup>
</script>
