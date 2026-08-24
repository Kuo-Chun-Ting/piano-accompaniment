<script setup lang="ts">
import type { ArrangementLevelName, ArrangementSet } from '~/shared/arrangement/types'
import type { ReferenceAudio } from '~/shared/audio/referenceAudio'
import { getMeasureSeekSeconds } from '~/shared/audio/playbackSchedule'
import {
  DEFAULT_PLAYBACK_BPM,
  resolveInitialPlaybackBpm,
} from '~/shared/audio/playbackTempo'
import type { ConfirmedChart } from '~/shared/schemas/chart'
import { formatElapsedTime } from '~/shared/ui/elapsedTime'
import { exportScoreAsPdf } from '~/shared/ui/scorePdf'

const props = withDefaults(defineProps<{
  active: boolean
  arrangements: ArrangementSet | null
  chart: ConfirmedChart | null
  showVersionSwitcher?: boolean
  referenceAudio?: ReferenceAudio
}>(), {
  showVersionSwitcher: true,
})

const selectedLevel = ref<ArrangementLevelName>('rich')
const scoreStage = ref<HTMLElement | null>(null)
const playbackSourceMenu = ref<HTMLDetailsElement | null>(null)
const {
  status: playbackStatus,
  errorMessage: playbackErrorMessage,
  mode: playbackMode,
  position: playbackPosition,
  togglePlayback,
  seekPlayback,
  changePlaybackTempo,
  setPlaybackMode,
  stopPlayback,
} = usePianoPlayback(toRef(props, 'referenceAudio'))
const playbackBpm = ref(DEFAULT_PLAYBACK_BPM)

const currentVersion = computed(() =>
  props.arrangements?.versions.find(version => version.level === selectedLevel.value) || null,
)
const sourceBpm = computed(() => props.chart?.tempo ?? null)
const scoreDurationSeconds = computed(() =>
  currentVersion.value
    ? getMeasureSeekSeconds(currentVersion.value.measures.length, 0, playbackBpm.value)
    : 0,
)
const showPlaybackPosition = computed(() =>
  playbackStatus.value !== 'idle' || playbackPosition.value.elapsedSeconds > 0,
)
const playbackLabel = computed(() => ({
  idle: 'Play',
  loading: 'Loading',
  paused: 'Play',
  playing: 'Pause',
})[playbackStatus.value])
const playbackSourceLabel = computed(() =>
  playbackMode.value === 'reference' ? 'Original Piano' : 'Score',
)

const levelLabels: Record<ArrangementLevelName, string> = {
  easy: 'Simple',
  rich: 'Rich',
}

watch(currentVersion, stopPlayback)
watch(
  () => props.active,
  async (active) => {
    if (!active) {
      return
    }

    await nextTick()
    scoreStage.value?.scrollTo({ top: 0, left: 0 })
  },
)
watch(
  () => props.chart,
  chart => {
    playbackBpm.value = resolveInitialPlaybackBpm(chart?.tempo ?? null)
  },
  { immediate: true },
)

async function handlePlayback(): Promise<void> {
  if (currentVersion.value) {
    await togglePlayback(currentVersion.value, playbackBpm.value)
  }
}

async function handleSeekMeasure(measureIndex: number, progress: number): Promise<void> {
  if (currentVersion.value) {
    await seekPlayback(
      currentVersion.value,
      playbackBpm.value,
      getMeasureSeekSeconds(measureIndex, progress, playbackBpm.value),
    )
  }
}

async function handleOverallSeek(event: Event): Promise<void> {
  if (!currentVersion.value) {
    return
  }

  const progress = Number((event.target as HTMLInputElement).value)
  await seekPlayback(
    currentVersion.value,
    playbackBpm.value,
    scoreDurationSeconds.value * progress,
  )
}

async function handleTempoChange(bpm: number): Promise<void> {
  if (bpm === playbackBpm.value) {
    return
  }

  playbackBpm.value = bpm
  if (currentVersion.value) {
    await changePlaybackTempo(currentVersion.value, bpm)
  }
}

async function handlePlaybackMode(mode: 'score' | 'reference'): Promise<void> {
  if (currentVersion.value) {
    await setPlaybackMode(mode, currentVersion.value, playbackBpm.value)
    playbackSourceMenu.value?.removeAttribute('open')
  }
}

function handleExportPdf(): void {
  exportScoreAsPdf({
    document: window.document,
    window,
    scoreTitle: props.chart?.title || 'Piano accompaniment',
  })
}
</script>

<template>
  <div
    class="score-workspace"
    :class="{
      ready: props.arrangements
        && currentVersion
        && props.arrangements.blockingIssues.length === 0,
    }"
  >
    <div v-if="props.arrangements?.blockingIssues.length" class="blocking">
      <p v-for="issue in props.arrangements.blockingIssues" :key="issue">{{ issue }}</p>
    </div>

    <template v-else-if="props.arrangements && currentVersion">
      <header class="score-toolbar">
        <strong>Score</strong>
        <div class="score-actions">
          <button
            class="download-button"
            type="button"
            data-tooltip="Export PDF"
            aria-label="Export score as PDF"
            @click="handleExportPdf"
          >
            ↓
          </button>
        </div>
      </header>

      <header class="score-controls">
        <div class="player-controls">
          <div class="transport">
            <button
              class="play"
              type="button"
              :disabled="playbackStatus === 'loading'"
              :aria-label="playbackLabel"
              :title="playbackLabel"
              @click="handlePlayback"
            >
              {{ playbackStatus === 'playing' ? 'Ⅱ' : '▶' }}
            </button>
            <button
              class="stop"
              type="button"
              :disabled="playbackStatus === 'idle' && playbackPosition.elapsedSeconds === 0"
              aria-label="Stop"
              title="Stop"
              @click="stopPlayback"
            >
              ■
            </button>
          </div>

          <input
            class="overall-progress"
            type="range"
            min="0"
            max="1"
            step="0.001"
            :value="playbackPosition.progress"
            aria-label="Playback progress"
            @change="handleOverallSeek"
          >
          <time>
            {{ formatElapsedTime(playbackPosition.elapsedSeconds) }}
            / {{ formatElapsedTime(playbackPosition.totalDurationSeconds || scoreDurationSeconds) }}
          </time>

          <details
            v-if="props.referenceAudio"
            ref="playbackSourceMenu"
            class="playback-source-menu"
            aria-label="Playback source menu"
          >
            <summary aria-label="Playback source">{{ playbackSourceLabel }}</summary>
            <div class="playback-source-options" role="menu">
              <button
                type="button"
                role="menuitemradio"
                aria-label="Score"
                :aria-checked="playbackMode === 'score'"
                @click="handlePlaybackMode('score')"
              >
                <span aria-hidden="true">{{ playbackMode === 'score' ? '✓' : '' }}</span>
                Score
              </button>
              <button
                type="button"
                role="menuitemradio"
                aria-label="Original Piano"
                :aria-checked="playbackMode === 'reference'"
                @click="handlePlaybackMode('reference')"
              >
                <span aria-hidden="true">{{ playbackMode === 'reference' ? '✓' : '' }}</span>
                Original Piano
              </button>
            </div>
          </details>
          <span v-else class="playback-source-label" aria-label="Playback source">Score</span>
        </div>

        <PlaybackTempoControl
          :model-value="playbackBpm"
          :source-bpm="sourceBpm"
          :disabled="playbackStatus === 'loading'"
          @update:model-value="handleTempoChange"
        />

        <div
          v-if="props.showVersionSwitcher"
          class="version-switcher"
          aria-label="Arrangement versions"
        >
          <button
            v-for="version in props.arrangements.versions"
            :key="version.level"
            type="button"
            :class="{ active: selectedLevel === version.level }"
            @click="selectedLevel = version.level"
          >
            {{ levelLabels[version.level] }}
          </button>
        </div>
      </header>

      <div ref="scoreStage" class="score-stage" data-workspace-scroll>
        <p v-if="playbackErrorMessage" class="playback-error">{{ playbackErrorMessage }}</p>
        <ClientOnly>
          <PianoScore
            :title="props.chart?.title || 'Piano accompaniment'"
            :tempo="playbackBpm"
            :version="currentVersion"
            :playback-position="playbackPosition"
            :show-playback-position="showPlaybackPosition"
            @seek-measure="handleSeekMeasure"
          />
          <template #fallback>
            <p class="loading">Loading score...</p>
          </template>
        </ClientOnly>
      </div>
    </template>
  </div>
</template>

<style scoped>
.score-workspace {
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: #ececee;
}
.score-workspace.ready {
  display: grid;
  grid-template-rows: 52px 70px minmax(0, 1fr);
}
.score-toolbar {
  display: flex;
  height: 52px;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(0,0,0,.09);
  background: rgba(250,250,252,.86);
  padding: 8px 16px;
}
.score-toolbar strong { font-weight: 620; }
.score-actions { display: flex; align-items: center; gap: 2px; }
.download-button {
  position: relative;
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #515154;
  font-size: 17px;
  cursor: pointer;
}
.download-button:hover { background: rgba(0,0,0,.055); }
.download-button::after {
  position: absolute;
  z-index: 20;
  top: calc(100% + 7px);
  left: 50%;
  padding: 5px 8px;
  border-radius: 6px;
  background: rgba(36,36,38,.94);
  color: #fff;
  content: attr(data-tooltip);
  font-size: 11px;
  line-height: 1;
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, -3px);
  transition: opacity 120ms ease, transform 120ms ease;
  white-space: nowrap;
}
.download-button:hover::after,
.download-button:focus-visible::after { opacity: 1; transform: translate(-50%, 0); }
.score-controls {
  position: sticky;
  top: 0;
  z-index: 5;
  display: grid;
  height: 70px;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid rgba(0,0,0,.09);
  background: rgba(250,250,252,.94);
  padding: 10px 16px;
  backdrop-filter: blur(18px);
}
.version-switcher {
  display: flex;
  gap: 2px;
  padding: 3px;
  border-radius: 7px;
  background: #e7e7ea;
}
.version-switcher button,
.transport button {
  height: 30px;
  border: 0;
  border-radius: 6px;
  padding: 0 12px;
  background: transparent;
  color: #636366;
  font: inherit;
  font-size: .74rem;
  font-weight: 600;
  cursor: pointer;
}
.version-switcher button.active { background: #fff; color: #1d1d1f; box-shadow: 0 1px 3px rgba(0, 0, 0, .14); }
.version-switcher button:focus-visible,
.playback-source-menu summary:focus-visible,
.playback-source-options button:focus-visible,
.transport button:focus-visible,
.download-button:focus-visible {
  outline: 2px solid #007aff;
  outline-offset: 2px;
}
.player-controls {
  display: grid;
  min-width: 0;
  grid-template-columns: auto minmax(120px, 1fr) auto;
  grid-template-rows: 32px 18px;
  align-items: center;
  column-gap: 10px;
}
.transport { display: flex; gap: 4px; }
.transport button {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 50%;
  padding: 0;
}
.transport .play { background: #1d1d1f; color: #fff; }
.transport .stop { border: 1px solid rgba(0,0,0,.16); background: #fff; color: #4c4c50; font-size: 10px; }
.transport button:disabled { color: #aeaeb2; cursor: default; }
.overall-progress { width: 100%; accent-color: #1d1d1f; }
time { color: #6e6e73; font-size: .72rem; font-variant-numeric: tabular-nums; white-space: nowrap; }
.playback-source-menu,
.playback-source-label {
  position: relative;
  grid-row: 2;
  grid-column: 1 / -1;
  justify-self: center;
  color: #6e6e73;
  font-size: .7rem;
  line-height: 18px;
}
.playback-source-menu summary {
  border-radius: 5px;
  padding: 0 16px 0 6px;
  cursor: pointer;
  list-style: none;
}
.playback-source-menu summary::-webkit-details-marker { display: none; }
.playback-source-menu summary::after {
  position: absolute;
  top: 0;
  right: 5px;
  content: '⌄';
}
.playback-source-menu summary:hover { background: rgba(0,0,0,.055); color: #1d1d1f; }
.playback-source-options {
  position: absolute;
  z-index: 20;
  top: calc(100% + 5px);
  left: 50%;
  display: grid;
  width: max-content;
  min-width: 150px;
  gap: 2px;
  border: 1px solid rgba(0,0,0,.1);
  border-radius: 9px;
  background: rgba(250,250,252,.98);
  padding: 4px;
  box-shadow: 0 8px 24px rgba(0,0,0,.16);
  transform: translateX(-50%);
}
.playback-source-options button {
  display: grid;
  height: 30px;
  grid-template-columns: 16px 1fr;
  align-items: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  padding: 0 10px 0 6px;
  color: #1d1d1f;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.playback-source-options button:hover { background: #e8e8ed; }
.blocking,
.playback-error {
  margin: 0;
  border-radius: 9px;
  background: #fff0ed;
  color: #b23c2f;
  padding: 10px 12px;
  font-size: .8rem;
}
.blocking p { margin: 0; }
.loading { color: #6e6e73; }
.score-stage { min-height: 0; overflow: auto; padding: 20px; }
@media (max-width: 1080px) {
  .score-controls { height: auto; grid-template-columns: minmax(0, 1fr) auto; }
  .score-controls :deep(.tempo-control) { grid-column: 2; }
  .version-switcher { grid-column: 1 / -1; }
}
@media (max-width: 620px) {
  .score-workspace.ready {
    height: auto;
    min-height: 720px;
    grid-template-rows: 52px auto minmax(0, 1fr);
  }
  .score-controls { height: auto; grid-template-columns: minmax(0, 1fr) auto; }
  .version-switcher { grid-column: 1 / -1; grid-row: auto; }
  .transport .stop { display: none; }
  .score-stage { height: auto; max-height: 720px; padding: 12px; }
}
</style>

<style>
@media print {
  body * { visibility: hidden !important; }
  .score-sheet,
  .score-sheet * { visibility: visible !important; }
  .score-sheet {
    position: absolute !important;
    inset: 0 auto auto 0 !important;
    width: 100% !important;
    min-width: 0 !important;
    box-shadow: none !important;
  }
  .score-sheet .system-progress { display: none !important; }
}
</style>
