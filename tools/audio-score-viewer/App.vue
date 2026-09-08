<script setup lang="ts">
import type { ArrangementSet, ScoreMetadata } from '../../shared/arrangement/types'
import { parseViewerData } from './viewerData'

const data = parseViewerData(__AUDIO_SCORE_DATA__)
const arrangements: ArrangementSet = {
  mood: 'spacious-ballad',
  versions: [data.version],
  blockingIssues: [],
}
const chart: ScoreMetadata = {
  title: data.title,
  tempo: data.tempo,
}
</script>

<template>
  <main>
    <ArrangementGrid
      active
      :arrangements="arrangements"
      :chart="chart"
      :show-version-switcher="false"
      :reference-audio="data.referenceAudio"
    />
  </main>
</template>

<style>
:root {
  color-scheme: light;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
}
html,
body,
#app,
main {
  width: 100%;
  height: 100%;
  margin: 0;
}
body { overflow: hidden; }
button,
input { font: inherit; }
</style>
