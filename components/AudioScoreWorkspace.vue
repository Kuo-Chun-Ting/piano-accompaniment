<script setup lang="ts">
const emit = defineEmits<{ busy: [value: boolean]; result: [value: boolean] }>()
const { file, job, error, busy, uploading, reconnecting, cancelling, selectFile, start, cancel, reset, reconnect } = useAudioScoreWorkspace()
const dragging = ref(false)
const filename = computed(() => file.value?.name || (job.value?.title ? `${job.value.title}.wav` : ''))
const filenameParts = computed(() => {
  const characters = Array.from(filename.value)
  return { start: characters.slice(0, -8).join(''), tail: characters.slice(-8).join('') }
})
const result = computed(() => job.value?.status === 'succeeded' ? job.value.result : undefined)
const locked = computed(() => busy.value || reconnecting.value)
const statusText = computed(() => cancelling.value ? 'Cancelling…' : reconnecting.value ? 'Connection lost' : uploading.value ? 'Uploading…' : 'Transcribing…')
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
  <section class="audio-workspace" :class="{ 'has-result': result }" aria-label="Audio transcription">
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
      <div class="drop-zone" :class="{ dragging, selected: filename, disabled: locked }"
        @dragover.prevent="dragging = !locked" @dragleave="onDragLeave" @drop.prevent="onDrop">
        <div class="file-row">
          <label class="file-picker" :class="{ 'file-info': filename }" :title="filename ? 'Choose another WAV file' : undefined">
            <svg class="note-icon" viewBox="0 0 32 40" aria-hidden="true">
              <path d="M20 29V5c0 7 10 5 8 15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
              <ellipse cx="13.5" cy="30" rx="7.5" ry="5" transform="rotate(-18 13.5 30)" fill="currentColor" />
            </svg>
            <span v-if="filename" class="filename" :title="filename" :aria-label="filename"><span class="filename-start">{{ filenameParts.start }}</span><span class="filename-tail">{{ filenameParts.tail }}</span></span>
            <span v-else class="picker-caption"><span>Choose a WAV file</span><span id="audio-file-limit" class="file-limit">Max 100 MB</span></span>
            <input aria-label="Audio file" :aria-describedby="!filename ? 'audio-file-limit' : undefined" type="file" accept=".wav,audio/wav" :disabled="locked" @change="onFile">
          </label>
          <button v-if="filename && !locked" class="remove-file" aria-label="Remove file" title="Remove file" @click="reset"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 8 8 8m0-8-8 8" /></svg></button>
        </div>
        <AudioFilePreview v-if="file" :file="file" :disabled="false" />
      </div>
      <div v-if="filename || locked" class="actions">
        <template v-if="locked">
          <p role="status" aria-live="polite" class="stage"><span v-if="!reconnecting || cancelling" class="spinner" aria-hidden="true" />{{ statusText }}</p>
          <button v-if="reconnecting && !cancelling" class="text-action" @click="reconnect">Reconnect</button>
          <button v-if="!uploading" class="text-action" :disabled="cancelling" @click="cancel">Cancel</button>
        </template>
        <button v-else-if="file" class="primary" data-test="start-transcription" @click="start">{{ job?.status === 'failed' ? 'Retry' : 'Transcribe' }}</button>
      </div>
      <p v-if="error" role="alert" class="error">{{ error }}</p>
    </div>
  </section>
</template>

<style scoped>
.audio-workspace { min-width: 0; }
.audio-import { width: 380px; max-width: 100%; margin: clamp(48px, 15vh, 160px) auto 0; }
.drop-zone { padding: 20px; border: 1px solid #dedee2; border-radius: 18px; background: #fff; box-shadow: 0 2px 8px #00000004; transition: border-color .15s, box-shadow .15s; }
.drop-zone.dragging { border-color: #636368; box-shadow: 0 0 0 3px #1d1d1f16; }
.file-row { display: flex; align-items: center; min-width: 0; gap: 8px; }
.file-picker { position: relative; display: flex; align-items: center; justify-content: center; min-width: 0; flex: 1; gap: 14px; min-height: 90px; border-radius: 8px; cursor: pointer; }
.selected .file-picker { min-height: 44px; justify-content: flex-start; }
.file-picker:hover { color: #636368; }
.disabled .file-picker { color: #1d1d1f; }
.note-icon { width: 32px; height: 40px; flex-shrink: 0; }
.picker-caption { display: flex; flex-direction: column; gap: 5px; font-size: 15px; }
.file-limit { color: #737378; font-size: 12px; }
.filename { display: flex; min-width: 0; font-size: 15px; white-space: nowrap; }
.filename-start { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.filename-tail { flex-shrink: 0; }
button { position: relative; font: inherit; font-size: 14px; padding: 10px 18px; border-radius: 9px; border: 1px solid #d7d7db; background: #fff; color: #1d1d1f; cursor: pointer; }
input[type="file"] { position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; cursor: pointer; }
.remove-file { flex-shrink: 0; width: 32px; height: 32px; padding: 0; border: 0; border-radius: 50%; background: transparent; color: #737378; display: grid; place-items: center; }
.remove-file svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; }
.remove-file:hover { background: #f0f0f2; color: #1d1d1f; }
label:has(input:focus-visible), button:focus-visible { outline: 2px solid #636368; outline-offset: 3px; }
.actions { display: flex; justify-content: flex-end; align-items: center; gap: 12px; margin-top: 16px; min-height: 40px; }
.text-action { border: 0; background: transparent; padding: 8px 0; color: #636368; font-size: 13px; }
.text-action:not(:disabled):hover { color: #1d1d1f; text-decoration: underline; }
.text-action:disabled { opacity: .5; }
.primary { background: #1d1d1f; border-color: #1d1d1f; color: white; }
.primary:hover { background: #353537; }
.primary:active { transform: translateY(1px); }
.primary:disabled { background: #e5e5e8; border-color: #e5e5e8; color: #88888d; }
button:disabled, input:disabled, .disabled .file-picker { cursor: default; }
.stage { display: flex; align-items: center; gap: 8px; color: #636368; font-size: 13px; margin: 0 auto 0 0; }
.spinner { width: 14px; height: 14px; border: 2px solid #d4d4d8; border-top-color: #636368; border-radius: 50%; animation: spin 1s linear infinite; }
.error { color: #b42318; line-height: 1.5; font-size: 14px; }
.result-heading { margin-bottom: 20px; }
.back { border: 0; background: none; padding: 4px 0; }
.has-result { height: calc(100dvh - 140px); min-height: 300px; display: flex; flex-direction: column; }
.audio-score-panel { flex: 1; min-height: 0; overflow: hidden; border: 1px solid #dedee2; border-radius: 14px; }
.audio-credit { text-align: right; font-size: 11px; margin-top: 12px; }
.audio-credit a { color: #86868b; text-decoration: none; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .spinner { animation: none; } .drop-zone { transition: none; } }
@media (pointer: coarse) { .remove-file { width: 44px; height: 44px; } }
</style>
