<script setup lang="ts">
import ProductIcon from './ProductIcon.vue'
</script>

<template>
  <header class="studio-toolbar">
    <div class="brand">
      <ProductIcon class="app-icon" />
      <h1>Piano Accompaniment Studio</h1>
    </div>
  </header>
</template>

<style scoped>
.studio-toolbar {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  min-height: 58px;
  align-items: center;
  gap: 18px;
  padding: 8px 22px;
  border-bottom: 1px solid rgba(0, 0, 0, .09);
  background: rgba(249, 249, 251, .78);
  backdrop-filter: saturate(180%) blur(22px);
}
.brand { display: flex; align-items: center; gap: 10px; }
.app-icon {
  display: block;
  width: 24px;
  height: 28px;
  flex-shrink: 0;
  color: #1d1d1f;
}
h1 {
  margin: 0;
  font-size: .88rem;
  font-weight: 650;
  letter-spacing: -.01em;
}
@media (max-width: 780px) {
  .studio-toolbar { grid-template-columns: 1fr auto; padding: 10px 12px; }
}
@media (max-width: 560px) {
  .brand { grid-column: 1 / -1; }
  .brand h1 { font-size: 13px; }
}
</style>
