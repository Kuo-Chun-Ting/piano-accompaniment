<script setup lang="ts">
type StudioView = 'chart' | 'score'

const props = defineProps<{
  activeView: StudioView
  chartAvailable: boolean
  scoreAvailable: boolean
}>()

const emit = defineEmits<{
  viewChanged: [view: StudioView]
}>()
</script>

<template>
  <header class="studio-toolbar">
    <div class="brand">
      <span class="app-icon" aria-hidden="true">♪</span>
      <h1>Piano Accompaniment Studio</h1>
    </div>

    <nav v-if="props.chartAvailable" class="view-switcher" aria-label="Workspace view">
      <button
        type="button"
        :class="{ active: props.activeView === 'chart' }"
        @click="emit('viewChanged', 'chart')"
      >
        Chart
      </button>
      <button
        type="button"
        :class="{ active: props.activeView === 'score' }"
        :disabled="!props.scoreAvailable"
        @click="emit('viewChanged', 'score')"
      >
        Score
      </button>
    </nav>
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
  display: grid;
  width: 24px;
  height: 28px;
  place-items: center;
  color: #1d1d1f;
  font-size: 19px;
  font-weight: 650;
}
h1 {
  margin: 0;
  font-size: .88rem;
  font-weight: 650;
  letter-spacing: -.01em;
}
.view-switcher {
  display: flex;
  gap: 2px;
  padding: 3px;
  border: 1px solid rgba(0, 0, 0, .07);
  border-radius: 9px;
  background: rgba(118, 118, 128, .1);
}
.view-switcher button {
  min-width: 72px;
  height: 28px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #636366;
  font: inherit;
  font-size: 13px;
  font-weight: 540;
  cursor: pointer;
}
.view-switcher button.active {
  background: #fff;
  color: #1d1d1f;
  box-shadow: 0 1px 4px rgba(0, 0, 0, .14);
}
.view-switcher button:disabled { color: #aeaeb2; cursor: default; }
@media (max-width: 780px) {
  .studio-toolbar { grid-template-columns: 1fr auto; padding: 10px 12px; }
  .view-switcher { grid-row: 2; grid-column: 1 / -1; justify-self: center; }
}
@media (max-width: 560px) {
  .brand { grid-column: 1 / -1; }
  .brand h1 { font-size: 13px; }
}
</style>
