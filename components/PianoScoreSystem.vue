<script setup lang="ts">
import {
  Accidental,
  Beam,
  Formatter,
  FretHandFinger,
  Modifier,
  Renderer,
  Stave,
  StaveConnector,
  StaveNote,
  Voice,
} from 'vexflow'
import type { ScoreEvent, ScoreLyricCue } from '~/shared/arrangement/types'
import {
  getScoreCueX,
  SCORE_SYSTEM_LAYOUT,
} from '~/shared/ui/scoreLayout'
import type { ScoreSystem } from '~/shared/ui/scoreSystems'

const props = defineProps<{
  system: ScoreSystem
}>()

const container = ref<HTMLDivElement | null>(null)
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  resizeObserver = new ResizeObserver(renderSystem)
  resizeObserver.observe(container.value!)
  renderSystem()
})

onBeforeUnmount(() => resizeObserver?.disconnect())
watch(() => props.system, () => nextTick(renderSystem), { deep: true })

function renderSystem(): void {
  if (!container.value || props.system.measures.length === 0) {
    return
  }

  container.value.innerHTML = ''
  const width = Math.max(container.value.clientWidth, 760)
  const renderer = new Renderer(container.value, Renderer.Backends.SVG)
  renderer.resize(width, SCORE_SYSTEM_LAYOUT.height)
  const context = renderer.getContext()
  const outerPadding = 16
  const measureWidth = (width - outerPadding * 2) / props.system.measures.length
  const staves = props.system.measures.map((measure, measureIndex) => {
    const x = outerPadding + measureIndex * measureWidth
    const treble = new Stave(x, SCORE_SYSTEM_LAYOUT.trebleStaveY, measureWidth)
    const bass = new Stave(x, SCORE_SYSTEM_LAYOUT.bassStaveY, measureWidth)

    if (measureIndex === 0) {
      treble.addClef('treble').addTimeSignature('4/4')
      bass.addClef('bass').addTimeSignature('4/4')
    }

    treble.setContext(context).draw()
    bass.setContext(context).draw()
    drawVoice(context, treble, measure.rightHand, 'treble', measureWidth, measureIndex === 0)
    drawVoice(context, bass, measure.leftHand, 'bass', measureWidth, measureIndex === 0)
    drawChordSymbols(context, treble, measure.rightHand, measureWidth, x)
    drawLyrics(context, bass, measure.lyrics, measureWidth, x)

    return { treble, bass }
  })

  const first = staves[0]
  const last = staves.at(-1)
  if (first) {
    drawConnector(context, first.treble, first.bass, 'brace')
    drawConnector(context, first.treble, first.bass, 'singleLeft')
  }
  if (last) {
    drawConnector(context, last.treble, last.bass, 'singleRight')
  }
}

function drawLyrics(
  context: ReturnType<Renderer['getContext']>,
  bass: Stave,
  lyrics: ScoreLyricCue[],
  staveWidth: number,
  staveX: number,
): void {
  if (lyrics.length === 0) {
    return
  }

  const noteStartX = bass.getNoteStartX()
  const noteEndX = staveX + staveWidth - 12
  context.setFont('Iowan Old Style, "Noto Serif TC", serif', 13, 400)
  lyrics.forEach((lyric) => {
    context.fillText(
      lyric.text,
      getScoreCueX(lyric.startBeat, noteStartX, noteEndX),
      SCORE_SYSTEM_LAYOUT.lyricBaselineY,
    )
  })
}

function drawChordSymbols(
  context: ReturnType<Renderer['getContext']>,
  treble: Stave,
  events: ScoreEvent[],
  staveWidth: number,
  staveX: number,
): void {
  const chordEvents = events.filter(event => event.chordSymbol)
  if (chordEvents.length === 0) {
    return
  }

  const noteStartX = treble.getNoteStartX()
  const noteEndX = staveX + staveWidth - 12
  context.setFont('Iowan Old Style, "Times New Roman", serif', 13, 500)
  chordEvents.forEach((event) => {
    context.fillText(
      event.chordSymbol!,
      getScoreCueX(event.startBeat, noteStartX, noteEndX),
      SCORE_SYSTEM_LAYOUT.chordBaselineY,
    )
  })
}

function drawConnector(
  context: ReturnType<Renderer['getContext']>,
  treble: Stave,
  bass: Stave,
  type: 'brace' | 'singleLeft' | 'singleRight',
): void {
  new StaveConnector(treble, bass).setType(type).setContext(context).draw()
}

function drawVoice(
  context: ReturnType<Renderer['getContext']>,
  stave: Stave,
  events: ScoreEvent[],
  clef: 'treble' | 'bass',
  staveWidth: number,
  isFirstMeasure: boolean,
): void {
  const notes = events.map(event => buildStaveNote(event, clef))
  const voice = new Voice({ numBeats: 4, beatValue: 4 }).addTickables(notes)
  const formattingWidth = Math.max(staveWidth - (isFirstMeasure ? 90 : 28), 100)
  new Formatter().joinVoices([voice]).format([voice], formattingWidth)
  voice.draw(context, stave)
  Beam.generateBeams(notes).forEach(beam => beam.setContext(context).draw())
}

function buildStaveNote(event: ScoreEvent, clef: 'treble' | 'bass'): StaveNote {
  const isRest = event.pitches.length === 0
  const keys = isRest ? [clef === 'treble' ? 'b/4' : 'd/3'] : event.pitches.map(toVexPitch)
  const note = new StaveNote({
    clef,
    keys,
    duration: `${toVexDuration(event.durationBeats)}${isRest ? 'r' : ''}`,
  })

  if (!isRest) {
    keys.forEach((key, index) => {
      const accidental = key.match(/([#b])\//)?.[1]
      if (accidental) {
        note.addModifier(new Accidental(accidental), index)
      }

      const finger = event.fingers[index]
      if (finger) {
        note.addModifier(
          new FretHandFinger(String(finger)).setPosition(
            clef === 'treble' ? Modifier.Position.ABOVE : Modifier.Position.BELOW,
          ),
          index,
        )
      }
    })
  }

  return note
}

function toVexPitch(pitch: string): string {
  const match = pitch.match(/^([A-G])([#b]?)(\d)$/)
  if (!match) {
    throw new Error(`Unsupported score pitch: ${pitch}`)
  }
  return `${match[1].toLowerCase()}${match[2]}/${match[3]}`
}

function toVexDuration(durationBeats: number): string {
  const duration = { 2: 'h', 1: 'q', 0.5: '8' }[durationBeats]
  if (!duration) {
    throw new Error(`Unsupported score duration: ${durationBeats}`)
  }
  return duration
}
</script>

<template>
  <div
    ref="container"
    class="score-system"
    :style="{ minHeight: `${SCORE_SYSTEM_LAYOUT.height}px` }"
    aria-label="Piano grand staff"
  />
</template>

<style scoped>
.score-system { overflow: hidden; }
.score-system :deep(svg) { display: block; }
</style>
