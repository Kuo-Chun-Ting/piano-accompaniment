<script setup lang="ts">
import type { ViewerScoreData } from '~/tools/audio-score-viewer/viewerData'
import type { ArrangementSet } from '~/shared/arrangement/types'
import type { ConfirmedChart } from '~/shared/schemas/chart'

const props = defineProps<{ data: ViewerScoreData }>()
const arrangements = computed<ArrangementSet>(() => ({
  mood: 'spacious-ballad', versions: [props.data.version], blockingIssues: [],
}))
const chart = computed<ConfirmedChart>(() => ({
  title: props.data.title, originalKey: 'C', mode: 'major', normalizedKey: 'C',
  meter: '4/4', tempo: props.data.tempo, mood: 'spacious-ballad', sections: [],
}))
</script>

<template>
  <ArrangementGrid
    active :arrangements="arrangements" :chart="chart"
    :show-version-switcher="false" :reference-audio="data.referenceAudio"
  />
</template>
