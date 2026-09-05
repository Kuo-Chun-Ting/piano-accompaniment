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
const draftProgress = ref<number | null>(null)
const shownProgress = computed(() => draftProgress.value ?? props.progress)
const shownSeconds = computed(() => draftProgress.value === null ? props.elapsedSeconds : draftProgress.value * props.durationSeconds)

function previewSeek(event: Event): void {
  const value = (event.target as HTMLInputElement).valueAsNumber
  if (Number.isFinite(value)) draftProgress.value = Math.min(1, Math.max(0, value))
}

function seek(event: Event): void {
  const progress = (event.target as HTMLInputElement).valueAsNumber
  if (Number.isFinite(progress)) emit('seek', Math.min(1, Math.max(0, progress)))
  draftProgress.value = null
}
</script>

<template>
  <div class="playback-controls">
    <div class="transport">
      <button class="play" type="button" :disabled="disabled || status === 'loading'" :aria-label="label" :title="label" @click="emit('toggle')">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path v-if="status === 'playing'" d="M8 6v12M16 6v12" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" />
          <path v-else d="M9 5.8a.8.8 0 0 0-1.2.7v11a.8.8 0 0 0 1.2.7l9-5.5a.8.8 0 0 0 0-1.4Z" fill="currentColor" />
        </svg>
      </button>
      <button v-if="showStop" class="stop" type="button" :disabled="disabled || stopDisabled" aria-label="Stop" title="Stop" @click="emit('stop')"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" /></svg></button>
    </div>
    <input class="overall-progress" type="range" min="0" max="1" step="0.001" :value="shownProgress" :disabled="disabled" aria-label="Playback progress" :aria-valuetext="`${formatElapsedTime(shownSeconds)} of ${formatElapsedTime(durationSeconds)}`" @input="previewSeek" @change="seek" @pointercancel="draftProgress = null" @blur="draftProgress = null">
    <time>{{ formatElapsedTime(shownSeconds) }} / {{ formatElapsedTime(durationSeconds) }}</time>
  </div>
</template>

<style scoped>
.playback-controls { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 10px; min-width: 0; }
.transport { display: flex; gap: 4px; }
.transport button { display: grid; width: 32px; height: 32px; place-items: center; border: 0; border-radius: 50%; padding: 0; font: inherit; font-size: .74rem; font-weight: 600; cursor: pointer; }
.transport .play { background: #1d1d1f; color: #fff; }
.transport svg { width: 20px; height: 20px; }
.transport button:not(:disabled):hover { filter: brightness(1.25); }
.transport button:not(:disabled):active { transform: scale(.94); }
.transport .stop { border: 1px solid rgba(0,0,0,.16); background: #fff; color: #4c4c50; font-size: 10px; }
.transport button:disabled { color: #aeaeb2; cursor: default; }
.transport button:focus-visible { outline: 2px solid #007aff; outline-offset: 2px; }
.overall-progress { width: 100%; min-width: 0; margin: 0; accent-color: #1d1d1f; cursor: pointer; }
time { color: #6e6e73; font-size: .72rem; font-variant-numeric: tabular-nums; white-space: nowrap; }
</style>
