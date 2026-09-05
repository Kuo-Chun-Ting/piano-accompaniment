<script setup lang="ts">
import { audioScoreStageLabel } from '~/shared/audio-transcription/job'

const emit = defineEmits<{ busy: [value: boolean]; result: [value: boolean] }>()
const { file, job, error, busy, uploading, reconnecting, selectFile, start, cancel, reset, reconnect } = useAudioScoreWorkspace()
const dragging = ref(false)
const filename = computed(() => file.value?.name || (job.value?.title ? `${job.value.title}.wav` : ''))
const filenameParts = computed(() => {
  const characters = Array.from(filename.value)
  return { start: characters.slice(0, -8).join(''), tail: characters.slice(-8).join('') }
})
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
      <div class="note-layout">
        <div
          class="drop-zone" :class="{ dragging, disabled: busy }"
          @dragover.prevent="dragging = !busy" @dragleave="onDragLeave" @drop.prevent="onDrop"
        >
          <svg class="note-stem" viewBox="0 0 240 310" aria-hidden="true">
            <path d="M177 250V12" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" />
            <path d="M177 12C177 40 225 45 230 88C234 113 227 139 216 155C229 119 226 93 208 80C198 72 186 67 177 64Z" fill="currentColor" />
          </svg>
          <label v-if="!filename" class="note-head file-picker">
            <span class="note-caption"><span>Choose a WAV file</span><span id="audio-file-limit" class="file-limit">Max 100 MB</span></span>
            <input aria-label="Audio file" aria-describedby="audio-file-limit" type="file" accept=".wav,audio/wav" :disabled="busy || reconnecting" @change="onFile">
          </label>
          <button v-else class="note-head transcribe" data-test="start-transcription" :disabled="!file || busy || reconnecting" @click="start">
            <span class="note-caption">{{ job?.status === 'failed' ? 'Retry' : 'Transcribe' }}</span>
          </button>
        </div>
        <div v-if="filename" class="file-info">
          <span class="filename" :title="filename" :aria-label="filename"><span class="filename-start">{{ filenameParts.start }}</span><span class="filename-tail">{{ filenameParts.tail }}</span></span>
          <button v-if="!busy && !reconnecting" class="remove-file" aria-label="Remove file" @click="reset">×</button>
        </div>
      </div>
      <AudioFilePreview v-if="file" :file="file" :disabled="busy || reconnecting" />
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
      </div>
    </div>
  </section>
</template>

<style scoped>
.audio-workspace { min-width: 0; }
.audio-import { width: 320px; max-width: 100%; margin: 0 auto; }
.note-layout { width: 240px; max-width: 100%; margin: 0 auto; }
.drop-zone { position: relative; height: 310px; color: #1d1d1f; }
.note-stem { display: block; width: 240px; height: 310px; pointer-events: none; }
.note-head { position: absolute; bottom: 10px; left: 22px; width: 160px; height: 106px; display: grid; place-items: center; border-radius: 50%; transform: rotate(-16deg); border: 1px solid #424245; background: #fff; padding: 0; cursor: pointer; transition: background .15s, box-shadow .15s, transform .15s; }
.note-caption { display: flex; flex-direction: column; align-items: center; gap: 5px; transform: rotate(16deg); font-size: 14px; white-space: nowrap; }
.file-limit { color: #737378; font-size: 11px; }
.note-head.transcribe { background: linear-gradient(155deg, #39393b, #232325); color: #fff; border-color: #1d1d1f; box-shadow: inset 0 1px 1px #ffffff38, 0 3px 5px #00000025; }
.note-head.transcribe:not(:disabled):hover { background: linear-gradient(155deg, #464649, #303032); box-shadow: inset 0 1px 1px #ffffff38, 0 4px 7px #0000002b; }
.note-head:not(:disabled):active { transform: rotate(-16deg) translateY(2px); box-shadow: none; }
.file-picker:hover, .dragging .note-head { background: #eeeef0; box-shadow: 0 0 0 3px #1d1d1f26; }
.dragging .note-stem { opacity: .6; }
.file-info { width: 200px; margin: 2px 0 0 2px; display: flex; align-items: center; justify-content: center; gap: 4px; min-height: 32px; }
.filename { display: flex; min-width: 0; font-size: 14px; white-space: nowrap; }
.filename-start { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.filename-tail { flex-shrink: 0; }
button { position: relative; font: inherit; font-size: 14px; padding: 10px 18px; border-radius: 9px; border: 1px solid #d7d7db; background: #fff; color: #1d1d1f; cursor: pointer; }
input[type="file"] { position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; cursor: pointer; }
.remove-file { flex-shrink: 0; width: 32px; height: 32px; padding: 0; border: 0; border-radius: 50%; background: transparent; color: #737378; font-size: 20px; }
.remove-file:hover { background: #f0f0f2; color: #1d1d1f; }
label:focus-within, button:focus-visible { outline: 2px solid #636368; outline-offset: 3px; }
.actions { display: flex; justify-content: center; gap: 12px; margin-top: 16px; }
.primary { background: #1d1d1f; border-color: #1d1d1f; color: white; }
.primary:disabled { background: #e5e5e8; border-color: #e5e5e8; color: #88888d; }
button:disabled, input:disabled, .disabled .file-picker { cursor: default; }
.transcribe:disabled { opacity: .5; box-shadow: none; }
.stage { display: flex; align-items: center; gap: 8px; color: #636368; font-size: 13px; margin: 8px 0 0; }
.spinner { width: 14px; height: 14px; border: 2px solid #d4d4d8; border-top-color: #636368; border-radius: 50%; animation: spin 1s linear infinite; }
.error { color: #b42318; line-height: 1.5; font-size: 14px; }
.result-heading { margin-bottom: 20px; }
.back { border: 0; background: none; padding: 4px 0; }
.audio-score-panel { height: max(650px, calc(100dvh - 210px)); overflow: hidden; border: 1px solid #dedee2; border-radius: 14px; }
.audio-credit { text-align: right; font-size: 11px; margin-top: 12px; }
.audio-credit a { color: #86868b; text-decoration: none; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .spinner { animation: none; } .note-head { transition: none; } }
@media (pointer: coarse) { .remove-file { width: 44px; height: 44px; } }
</style>
