<script setup lang="ts">
import {
  MAX_PLAYBACK_BPM,
  MIN_PLAYBACK_BPM,
  normalizePlaybackBpm,
} from '~/shared/audio/playbackTempo'

const props = defineProps<{
  modelValue: number
  sourceBpm: number | null
  disabled: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [bpm: number]
}>()

function emitTempo(event: Event): void {
  const input = event.target as HTMLInputElement
  const bpm = normalizePlaybackBpm(input.valueAsNumber, props.modelValue)
  input.value = String(bpm)
  emit('update:modelValue', bpm)
}

function emitTempoWhileTyping(event: Event): void {
  const input = event.target as HTMLInputElement
  const bpm = input.valueAsNumber

  if (!Number.isInteger(bpm) || bpm < MIN_PLAYBACK_BPM || bpm > MAX_PLAYBACK_BPM) {
    return
  }

  emit('update:modelValue', bpm)
}
</script>

<template>
  <div class="tempo-control">
    <label for="playback-tempo">Tempo</label>
    <input
      id="playback-tempo"
      class="tempo-number"
      type="number"
      inputmode="numeric"
      :min="MIN_PLAYBACK_BPM"
      :max="MAX_PLAYBACK_BPM"
      :value="props.modelValue"
      :disabled="props.disabled"
      :title="props.sourceBpm ? `Source tempo: ${props.sourceBpm} BPM` : undefined"
      aria-label="Playback BPM"
      @input="emitTempoWhileTyping"
      @change="emitTempo"
    >
    <span>BPM</span>
  </div>
</template>

<style scoped>
.tempo-control {
  display: flex;
  min-height: 32px;
  align-items: center;
  gap: 6px;
  border: 1px solid rgba(0,0,0,.16);
  border-radius: 8px;
  background: #fff;
  padding: 0 9px;
}
.tempo-control > label { color: #6e6e73; font-size: .72rem; font-weight: 600; }
.tempo-number {
  width: 38px;
  border: 0;
  outline: 0;
  background: transparent;
  color: #1d1d1f;
  padding: 0;
  text-align: right;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
}
.tempo-control > span { color: #6e6e73; font-size: 11px; }
input:disabled { cursor: wait; opacity: .55; }
</style>
