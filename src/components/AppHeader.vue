<template>
  <header class="flora-header flex items-center justify-between px-4 md:px-8 py-4">
    <div class="flex items-center gap-2">
      <slot name="left" />
    </div>
    
    <div class="flex items-center gap-4">
      <slot name="center" />
      <slot name="right" />
    </div>
  </header>
</template>

<script setup>
/**
 * App Header component
 * Reusable header with slots for customization
 */
</script>
