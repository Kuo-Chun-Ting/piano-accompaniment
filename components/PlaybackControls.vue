<script setup lang="ts">
import { formatElapsedTime } from '~/shared/ui/elapsedTime'

const props = withDefaults(defineProps<{
  status: 'idle' | 'loading' | 'paused' | 'playing'
  progress: number
  elapsedSeconds: number
  durationSeconds: number
  disabled?: boolean
  showStop?: boolean
  stopDisabled?: boolean
}>(), { disabled: false, showStop: false, stopDisabled: false })
const emit = defineEmits<{ toggle: []; stop: []; seek: [progress: number] }>()
const label = computed(() => props.status === 'loading' ? 'Loading' : props.status === 'playing' ? 'Pause' : 'Play')

function seek(event: Event): void {
  const progress = (event.target as HTMLInputElement).valueAsNumber
  if (Number.isFinite(progress)) emit('seek', Math.min(1, Math.max(0, progress)))
}
</script>

<template>
  <div class="playback-controls">
    <div class="transport">
      <button class="play" type="button" :disabled="disabled || status === 'loading'" :aria-label="label" :title="label" @click="emit('toggle')">
        {{ status === 'playing' ? 'Ⅱ' : '▶' }}
      </button>
      <button v-if="showStop" class="stop" type="button" :disabled="disabled || stopDisabled" aria-label="Stop" title="Stop" @click="emit('stop')">■</button>
    </div>
    <input class="overall-progress" type="range" min="0" max="1" step="0.001" :value="progress" :disabled="disabled" aria-label="Playback progress" @change="seek">
    <time>{{ formatElapsedTime(elapsedSeconds) }} / {{ formatElapsedTime(durationSeconds) }}</time>
  </div>
</template>

<style scoped>
.playback-controls { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 10px; min-width: 0; }
.transport { display: flex; gap: 4px; }
.transport button { display: grid; width: 32px; height: 32px; place-items: center; border: 0; border-radius: 50%; padding: 0; font: inherit; font-size: .74rem; font-weight: 600; cursor: pointer; }
.transport .play { background: #1d1d1f; color: #fff; }
.transport .stop { border: 1px solid rgba(0,0,0,.16); background: #fff; color: #4c4c50; font-size: 10px; }
.transport button:disabled { color: #aeaeb2; cursor: default; }
.transport button:focus-visible { outline: 2px solid #007aff; outline-offset: 2px; }
.overall-progress { width: 100%; min-width: 0; margin: 0; accent-color: #1d1d1f; }
time { color: #6e6e73; font-size: .72rem; font-variant-numeric: tabular-nums; white-space: nowrap; }
</style>
