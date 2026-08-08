<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import type { ScoreVersion } from '~/shared/arrangement/types'
import type { PlaybackPosition } from '~/shared/audio/playbackSchedule'
import {
  buildScoreSystems,
  getScoreSystemProgress,
  getScoreSystemSeekTarget,
} from '~/shared/ui/scoreSystems'

const props = defineProps<{
  title: string
  tempo?: number
  version: ScoreVersion
  playbackPosition: PlaybackPosition
  showPlaybackPosition: boolean
}>()

const emit = defineEmits<{
  playMeasure: [measureIndex: number]
  seekMeasure: [measureIndex: number, progress: number]
}>()

const systems = computed(() => buildScoreSystems(props.version.measures))
const systemElements = new Map<number, HTMLElement>()

watch(
  () => props.showPlaybackPosition ? props.playbackPosition.measureIndex : null,
  async (measureIndex) => {
    if (measureIndex === null) {
      return
    }

    await nextTick()
    const systemIndex = systems.value.findIndex(system =>
      measureIndex >= system.startMeasureIndex
      && measureIndex < system.startMeasureIndex + system.measures.length)
    const element = systemElements.get(systemIndex)
    if (element && !isVisible(element)) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  },
)

function setSystemElement(
  element: Element | ComponentPublicInstance | null,
  systemIndex: number,
): void {
  if (element instanceof HTMLElement) {
    systemElements.set(systemIndex, element)
  } else {
    systemElements.delete(systemIndex)
  }
}

function getProgress(systemIndex: number): number {
  if (!props.showPlaybackPosition) {
    return 0
  }
  return getScoreSystemProgress(systems.value[systemIndex], props.playbackPosition)
}

function getProgressStyle(systemIndex: number): Record<string, string> {
  return { '--system-progress': `${getProgress(systemIndex) * 100}%` }
}

function handleSystemClick(event: MouseEvent, systemIndex: number): void {
  const target = event.target as HTMLElement
  if (target.closest('[data-progress-control]')) {
    return
  }

  const element = systemElements.get(systemIndex)
  if (!element) {
    return
  }

  const bounds = element.getBoundingClientRect()
  const progress = Math.min(Math.max((event.clientX - bounds.left) / bounds.width, 0), 1)
  const seekTarget = getScoreSystemSeekTarget(systems.value[systemIndex], progress)
  emit('playMeasure', seekTarget.measureIndex)
}

function handleSeek(event: Event, systemIndex: number): void {
  const input = event.target as HTMLInputElement
  const seekTarget = getScoreSystemSeekTarget(
    systems.value[systemIndex],
    Number(input.value),
  )
  emit('seekMeasure', seekTarget.measureIndex, seekTarget.measureProgress)
}

function isVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect()
  return rect.top >= 0 && rect.bottom <= window.innerHeight
}
</script>

<template>
  <div class="score-sheet" aria-label="Piano score">
    <header class="score-title">
      <h2>{{ props.title }}</h2>
    </header>
    <p v-if="props.tempo" class="score-marking">♩ = {{ props.tempo }}</p>

    <article
      v-for="(system, systemIndex) in systems"
      :key="system.startMeasureIndex"
      :ref="element => setSystemElement(element, systemIndex)"
      class="system-row"
      @click="handleSystemClick($event, systemIndex)"
    >
      <input
        data-progress-control
        class="system-progress"
        type="range"
        min="0"
        max="1"
        step="0.001"
        :value="getProgress(systemIndex)"
        :style="getProgressStyle(systemIndex)"
        :aria-label="`Score line ${systemIndex + 1} progress`"
        @click.stop
        @pointerdown.stop
        @change="handleSeek($event, systemIndex)"
      >
      <PianoScoreSystem :system="system" />
    </article>
  </div>
</template>

<style scoped>
.score-sheet {
  width: min(1280px, 100%);
  min-width: 760px;
  min-height: 1000px;
  box-sizing: border-box;
  margin: 0 auto;
  padding: 38px 42px 54px;
  background: #fff;
  color: #111;
  box-shadow: 0 10px 30px rgba(0,0,0,.12);
}
.score-title {
  position: relative;
  margin-bottom: 30px;
  padding: 0 4px;
  text-align: center;
}
.score-title h2 {
  margin: 0;
  font-family: "New York", "Iowan Old Style", "Times New Roman", "Noto Serif TC", serif;
  font-size: 29px;
  font-weight: 500;
  letter-spacing: .04em;
}
.score-marking {
  margin: -16px 0 10px 58px;
  color: #333;
  font-family: "New York", "Times New Roman", serif;
  font-size: 12px;
  font-style: italic;
}
.system-row { margin-bottom: 24px; cursor: pointer; }
.system-progress {
  --system-progress: 0%;
  display: block;
  width: calc(100% - 24px);
  height: 12px;
  margin: 0 12px -2px;
  border: 0;
  background: transparent;
  cursor: pointer;
  appearance: none;
}
.system-progress::-webkit-slider-runnable-track {
  height: 2px;
  background: linear-gradient(
    to right,
    #1d1d1f var(--system-progress),
    #d7d7dc var(--system-progress)
  );
}
.system-progress::-webkit-slider-thumb {
  width: 10px;
  height: 10px;
  margin-top: -4px;
  border: 2px solid #fff;
  border-radius: 50%;
  background: #1d1d1f;
  box-shadow: 0 1px 3px rgba(0, 0, 0, .28);
  appearance: none;
}
.system-progress::-moz-range-track { height: 2px; background: #d7d7dc; }
.system-progress::-moz-range-progress { height: 2px; background: #1d1d1f; }
.system-progress::-moz-range-thumb {
  width: 8px;
  height: 8px;
  border: 2px solid #fff;
  border-radius: 50%;
  background: #1d1d1f;
}
@media (max-width: 620px) {
  .score-sheet { min-width: 720px; padding: 24px 22px 32px; }
}
</style>
