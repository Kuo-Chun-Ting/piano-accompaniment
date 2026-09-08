<script setup lang="ts">
import type { ViewerScoreData } from '~/tools/audio-score-viewer/viewerData'
import type { ArrangementSet, ScoreMetadata } from '~/shared/arrangement/types'

const props = defineProps<{ data: ViewerScoreData }>()
const arrangements = computed<ArrangementSet>(() => ({
  mood: 'spacious-ballad', versions: [props.data.version], blockingIssues: [],
}))
const chart = computed<ScoreMetadata>(() => ({
  title: props.data.title, tempo: props.data.tempo,
}))
</script>

<template>
  <ArrangementGrid
    active :arrangements="arrangements" :chart="chart"
    :show-version-switcher="false" :reference-audio="data.referenceAudio"
  />
</template>
