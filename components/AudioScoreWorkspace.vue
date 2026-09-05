<script setup lang="ts">
import { audioScoreStageLabel } from '~/shared/audio-transcription/job'

const emit = defineEmits<{ busy: [value: boolean]; result: [value: boolean] }>()
const { file, job, error, busy, uploading, reconnecting, selectFile, start, cancel, reset, reconnect } = useAudioScoreWorkspace()
const dragging = ref(false)
const result = computed(() => job.value?.status === 'succeeded' ? job.value.result : undefined)
watch(busy, value => emit('busy', value), { immediate: true })
watch(result, value => emit('result', Boolean(value)), { immediate: true })

function onFile(event: Event): void {
  selectFile((event.target as HTMLInputElement).files?.[0])
  ;(event.target as HTMLInputElement).value = ''
}
function onDrop(event: DragEvent): void {
  dragging.value = false
  if (event.dataTransfer?.files.length !== 1) return
  selectFile(event.dataTransfer.files[0])
}
function onDragLeave(event: DragEvent): void {
  const zone = event.currentTarget as HTMLElement
  if (event.relatedTarget instanceof Node && zone.contains(event.relatedTarget)) return
  dragging.value = false
}
</script>

<template>
  <section class="audio-workspace" aria-label="Audio transcription">
    <template v-if="result">
      <header class="result-heading">
        <button class="back" @click="reset">← New Upload</button>
      </header>
      <AudioScoreResult class="audio-score-panel" :data="result" />
      <footer class="audio-credit">
        <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">Salamander Grand Piano · Alexander Holm · CC BY 3.0</a>
      </footer>
    </template>
    <div v-else class="audio-import">
      <div
        class="drop-zone" :class="{ dragging, disabled: busy }"
        @dragover.prevent="dragging = !busy" @dragleave="onDragLeave" @drop.prevent="onDrop"
      >
        <label class="file-picker">
          <svg class="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
            <path d="M4 10v4m4-7v10m4-14v18m4-14v10m4-7v4" />
          </svg>
          <span class="filename" :title="file?.name">
            {{ file?.name || (job?.title ? `${job.title}.wav` : 'Choose or drop a WAV file') }}
          </span>
          <input aria-label="Audio file" aria-describedby="audio-file-limit" type="file" accept=".wav,audio/wav" :disabled="busy" @change="onFile">
        </label>
        <button v-if="file && !busy" class="remove-file" aria-label="Remove file" @click="reset">×</button>
      </div>
      <p id="audio-file-limit" class="file-limit">WAV · Max 100 MB</p>
      <p v-if="busy" role="status" aria-live="polite" class="stage">
        <span class="spinner" aria-hidden="true" />{{ audioScoreStageLabel(uploading ? 'uploading' : job?.stage ?? 'starting') }}
      </p>
      <p v-if="job?.status === 'cancelled'" role="status" class="stage">Transcription cancelled</p>
      <p v-if="error" role="alert" class="error">{{ error }}</p>
      <div class="actions">
        <template v-if="reconnecting">
          <button class="primary" @click="reconnect">Reconnect</button>
          <button @click="cancel">Cancel</button>
        </template>
        <button v-else-if="busy && !uploading" @click="cancel">Cancel</button>
        <button v-else class="primary" data-test="start-transcription" :disabled="!file || busy" @click="start">
          {{ job?.status === 'failed' ? 'Retry' : 'Create Score' }}
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.audio-workspace { min-width: 0; }
.audio-import { width: min(100%, 480px); margin: 0 auto; }
.drop-zone { position: relative; border: 1px dashed #b8b8bd; border-radius: 12px; background: #fff; transition: border-color .15s, background .15s; }
.drop-zone:not(.disabled):hover { border-color: #636368; }
.drop-zone.dragging { border-color: #636368; background: #f0f0f2; outline: 2px solid #636368; outline-offset: -2px; }
.file-limit { color: #737378; font-size: 12px; margin: 10px 0 0; }
.file-picker { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; height: 144px; padding: 24px 48px; border-radius: 12px; cursor: pointer; }
.file-icon { width: 28px; height: 28px; flex-shrink: 0; color: #737378; }
.filename { max-width: 100%; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
button { position: relative; font: inherit; font-size: 14px; padding: 10px 18px; border-radius: 9px; border: 1px solid #d7d7db; background: #fff; color: #1d1d1f; cursor: pointer; }
input[type="file"] { position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; cursor: pointer; }
.remove-file { position: absolute; top: 4px; right: 4px; width: 40px; height: 40px; padding: 0; border: 0; border-radius: 50%; background: transparent; color: #737378; font-size: 23px; }
.remove-file:hover { background: #f0f0f2; color: #1d1d1f; }
label:focus-within, button:focus-visible { outline: 2px solid #636368; outline-offset: 3px; }
.actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 16px; }
.primary { background: #1d1d1f; border-color: #1d1d1f; color: white; }
.primary:disabled { background: #e5e5e8; border-color: #e5e5e8; color: #88888d; }
button:disabled, input:disabled, .disabled .file-picker { cursor: default; }
.stage { display: flex; align-items: center; gap: 8px; color: #636368; font-size: 13px; margin: 8px 0 0; }
.spinner { width: 14px; height: 14px; border: 2px solid #d4d4d8; border-top-color: #636368; border-radius: 50%; animation: spin 1s linear infinite; }
.error { color: #b42318; line-height: 1.5; font-size: 14px; }
.result-heading { margin-bottom: 20px; }
.back { border: 0; background: none; padding: 4px 0; }
.audio-score-panel { height: max(650px, calc(100dvh - 210px)); overflow: hidden; border: 1px solid #dedee2; border-radius: 14px; }
.audio-credit { text-align: right; font-size: 11px; margin-top: 12px; }
.audio-credit a { color: #86868b; text-decoration: none; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .spinner { animation: none; } }
@media (pointer: coarse) { .remove-file { width: 44px; height: 44px; } }
</style>
