<script setup lang="ts">
const props = defineProps<{ file: File; disabled: boolean }>()
const audio = ref<HTMLAudioElement | null>(null)
const src = ref('')
const elapsed = ref(0)
const duration = ref(0)
const playing = ref(false)
const error = ref('')
let playbackAttempt = 0
const progress = computed(() => duration.value ? elapsed.value / duration.value : 0)

function pause(): void {
  playbackAttempt++
  audio.value?.pause()
}

function release(): void {
  pause()
  audio.value?.removeAttribute('src')
  audio.value?.load()
  if (src.value) URL.revokeObjectURL(src.value)
}

watch(() => props.file, file => {
  release()
  elapsed.value = 0
  duration.value = 0
  playing.value = false
  error.value = ''
  src.value = URL.createObjectURL(file)
}, { immediate: true })
watch(() => props.disabled, disabled => { if (disabled) pause() })
onBeforeUnmount(release)

function syncTime(): void {
  elapsed.value = audio.value?.currentTime ?? 0
  const seconds = audio.value?.duration ?? 0
  duration.value = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
}

async function toggle(): Promise<void> {
  const media = audio.value
  if (!media || props.disabled) return
  if (playing.value) { pause(); return }
  const attempt = ++playbackAttempt
  error.value = ''
  try {
    if (media.ended) media.currentTime = 0
    await media.play()
  } catch {
    if (attempt === playbackAttempt) error.value = 'Could not preview this file. Try again.'
  }
}

function seek(fraction: number): void {
  if (!audio.value || props.disabled || !duration.value) return
  audio.value.currentTime = duration.value * fraction
  syncTime()
}

function onError(): void {
  playing.value = false
  duration.value = 0
  error.value = 'This file cannot be previewed in this browser.'
}
</script>

<template>
  <section class="audio-preview" aria-label="Audio preview">
    <audio ref="audio" :src="src" preload="metadata" @loadedmetadata="syncTime" @durationchange="syncTime" @timeupdate="syncTime" @play="playing = true" @pause="playing = false" @ended="playing = false" @error="onError" />
    <PlaybackControls :status="playing ? 'playing' : 'paused'" :progress="progress" :elapsed-seconds="elapsed" :duration-seconds="duration" :disabled="disabled || !duration" @toggle="toggle" @seek="seek" />
    <p v-if="error" role="alert">{{ error }}</p>
  </section>
</template>

<style scoped>
.audio-preview { width: 100%; margin: 16px auto 0; }
audio { display: none; }
p { color: #b42318; font-size: 12px; line-height: 1.5; margin: 10px 0 0; }
</style>
