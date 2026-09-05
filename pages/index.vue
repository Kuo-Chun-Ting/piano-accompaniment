<script setup lang="ts">
import type { ConfirmChartSelection } from '~/shared/schemas/chart'
import {
  CHART_READING_MODEL_OPTIONS,
  buildChartReadingStatusText,
} from '~/shared/ui/chartReading'

type StudioView = 'chart' | 'score'

const workspace = useChartWorkspace()
const activeView = ref<StudioView>('chart')
const hasChart = computed(() => workspace.extractedChart.value !== null)
const source = ref<'audio' | 'image'>('audio')
const audioHasResult = ref(false)
const hasScore = computed(() =>
  workspace.arrangements.value !== null && workspace.confirmedChart.value !== null,
)
const pageTitle = computed(() =>
  workspace.extractedChart.value?.title.value || 'Untitled',
)

const chartReadingStatusText = computed(() => buildChartReadingStatusText({
  state: workspace.isParsing.value ? 'reading' : workspace.chartReadingStatus.value,
  elapsedSeconds: workspace.isParsing.value
    ? workspace.parsingElapsedSeconds.value
    : workspace.lastParsingElapsedSeconds.value,
}))

watch(hasChart, (available) => {
  if (!available) {
    activeView.value = 'chart'
  }
})

watch(hasScore, (available) => {
  if (!available) {
    activeView.value = 'chart'
  }
})

async function handleFiles(files: File[]): Promise<void> {
  await workspace.setFiles(files)
  activeView.value = 'chart'
}

function handleConfirm(selection: ConfirmChartSelection): void {
  workspace.confirmChart(selection)
  if (workspace.arrangements.value) {
    activeView.value = 'score'
  }
}
</script>

<template>
  <main class="app-shell">
    <StudioToolbar
      :active-view="activeView"
      :chart-available="source === 'image' && hasChart"
      :score-available="source === 'image' && hasScore"
      @view-changed="activeView = $event"
    />

    <div class="workspace">
      <header v-if="source !== 'audio' || !audioHasResult" class="source-heading">
        <h1 v-if="!hasChart || source === 'audio'">Create Piano Score</h1>
        <div class="source-picker" role="group" aria-label="Input source">
          <button :aria-pressed="source === 'audio'" @click="source = 'audio'">Audio File</button>
          <button :aria-pressed="source === 'image'" disabled>Chord Sheet Image</button>
        </div>
      </header>
      <AudioScoreWorkspace v-if="source === 'audio'" @result="audioHasResult = $event" />
      <template v-if="source === 'image'">
      <UploadPanel
        v-if="!hasChart"
        :file-names="workspace.uploadedImages.value.map(image => image.filename)"
        :model-options="CHART_READING_MODEL_OPTIONS"
        :selected-model="workspace.selectedModel.value"
        :is-parsing="workspace.isParsing.value"
        :can-analyze="workspace.uploadedImages.value.length > 0"
        :status-text="chartReadingStatusText"
        :error-message="workspace.error.value?.message || null"
        @files-selected="handleFiles"
        @model-changed="workspace.setReadingModel"
        @analyze="workspace.parseUploadedImages"
        @stop="workspace.stopParsing"
        @clear="workspace.clearWorkspace"
      />

      <header v-else class="workspace-heading">
        <h2>{{ pageTitle }}</h2>
      </header>

      <ChartComparison
        v-if="workspace.extractedChart.value"
        v-show="activeView === 'chart'"
        class="workspace-panel"
        :images="workspace.uploadedImages.value"
        :content-id="activeView"
        :disabled="workspace.isParsing.value"
        @files-selected="handleFiles"
        @clear="workspace.clearWorkspace"
      >
        <ChartReview
          :chart="workspace.extractedChart.value"
          @confirm="handleConfirm"
        />
      </ChartComparison>

      <ArrangementGrid
        v-if="hasScore"
        v-show="activeView === 'score'"
        class="score-view workspace-panel"
        :active="activeView === 'score'"
        :arrangements="workspace.arrangements.value"
        :chart="workspace.confirmedChart.value"
      />

      <footer v-if="hasScore && activeView === 'score'" class="audio-credit">
        Piano audio:
        <a
          href="https://creativecommons.org/licenses/by/3.0/"
          target="_blank"
          rel="noreferrer"
        >
          Salamander Grand Piano by Alexander Holm, CC BY 3.0
        </a>
      </footer>
      </template>
    </div>
  </main>
</template>

<style scoped>
:global(html),
:global(body) {
  margin: 0;
}
.app-shell {
  min-height: 100vh;
  background:
    radial-gradient(circle at 15% -10%, rgba(0, 0, 0, .035), transparent 29rem),
    #f5f5f7;
  color: #1d1d1f;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang TC", sans-serif;
  -webkit-font-smoothing: antialiased;
}
.app-shell,
.app-shell :deep(*) {
  box-sizing: border-box;
}
.app-shell > :deep(.studio-toolbar) { position: sticky; top: 0; z-index: 20; }
.workspace {
  display: grid;
  width: calc(100% - 48px);
  gap: 18px;
  margin: 30px auto 50px;
}
.workspace-panel {
  height: max(720px, calc(100dvh - 112px));
  overflow: hidden;
}
.workspace-heading {
  display: flex;
  min-height: 44px;
  align-items: center;
}
.source-heading { text-align: center; margin: 8px 0 6px; }
.source-heading h1 { font-size: clamp(24px, 3vw, 28px); letter-spacing: -.035em; margin: 0 0 20px; font-weight: 650; }
.source-picker { display: inline-flex; padding: 3px; background: #e8e8ed; border-radius: 10px; }
.source-picker button { border: 0; border-radius: 8px; background: transparent; color: #55555b; padding: 9px 22px; font: inherit; font-size: 14px; cursor: pointer; }
.source-picker button[aria-pressed="true"] { background: white; color: #1d1d1f; box-shadow: 0 1px 4px #0002; }
.source-picker button:disabled { opacity: .4; cursor: default; }
.source-picker button:focus-visible { outline: 3px solid #007aff; outline-offset: 2px; }
.workspace-heading h2 {
  margin: 0;
  font-size: clamp(28px, 3vw, 40px);
  font-weight: 690;
  letter-spacing: -.035em;
  line-height: 1.08;
}
.score-view {
  border: 1px solid rgba(0,0,0,.09);
  border-radius: 16px;
  box-shadow: 0 18px 60px rgba(0,0,0,.08);
}
.audio-credit {
  color: #8e8e93;
  font-size: 11px;
  text-align: right;
}
.audio-credit a { color: inherit; text-decoration: none; }
.audio-credit a:hover { text-decoration: underline; }
@media (max-width: 720px) {
  .workspace {
    width: calc(100% - 20px);
    margin-top: 18px;
  }
  .workspace-panel { height: 720px; }
}
</style>
