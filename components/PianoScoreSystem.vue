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
  StaveTie,
  Voice,
} from 'vexflow'
import type {
  ScoreEvent,
  ScoreKeySignature,
  ScoreLyricCue,
} from '~/shared/arrangement/types'
import {
  getScoreCueX,
  SCORE_SYSTEM_LAYOUT,
} from '~/shared/ui/scoreLayout'
import type { ScoreSystem } from '~/shared/ui/scoreSystems'

const props = defineProps<{
  system: ScoreSystem
  keySignature?: ScoreKeySignature
}>()

const container = ref<HTMLDivElement | null>(null)
let resizeObserver: ResizeObserver | null = null

type RenderedVoice = {
  events: ScoreEvent[]
  notes: StaveNote[]
  voice: Voice
  beams: Beam[]
}

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
      treble.addClef('treble').addKeySignature(props.keySignature ?? 'C').addTimeSignature('4/4')
      bass.addClef('bass').addKeySignature(props.keySignature ?? 'C').addTimeSignature('4/4')
    }

    treble.setContext(context).draw()
    bass.setContext(context).draw()
    const { trebleVoice, bassVoice } = drawGrandStaffVoices(
      context,
      treble,
      bass,
      measure.rightHand,
      measure.leftHand,
      measureWidth,
      measureIndex === 0,
    )
    drawChordSymbols(context, treble, measure.rightHand, measureWidth, x)
    drawLyrics(context, bass, measure.lyrics, measureWidth, x)

    return { treble, bass, trebleVoice, bassVoice }
  })

  drawVoiceTies(context, staves.map(stave => stave.trebleVoice))
  drawVoiceTies(context, staves.map(stave => stave.bassVoice))

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

function drawGrandStaffVoices(
  context: ReturnType<Renderer['getContext']>,
  treble: Stave,
  bass: Stave,
  rightHand: ScoreEvent[],
  leftHand: ScoreEvent[],
  staveWidth: number,
  isFirstMeasure: boolean,
): { trebleVoice: RenderedVoice, bassVoice: RenderedVoice } {
  const trebleVoice = buildRenderedVoice(rightHand, 'treble')
  const bassVoice = buildRenderedVoice(leftHand, 'bass')
  Accidental.applyAccidentals([trebleVoice.voice], props.keySignature ?? 'C')
  Accidental.applyAccidentals([bassVoice.voice], props.keySignature ?? 'C')
  const voices = [trebleVoice.voice, bassVoice.voice]
  const formatter = new Formatter()
    .joinVoices([trebleVoice.voice])
    .joinVoices([bassVoice.voice])
  const formattingWidth = Math.max(staveWidth - (isFirstMeasure ? 90 : 28), 100)
  formatter.format(voices, formattingWidth)

  drawRenderedVoice(context, treble, trebleVoice)
  drawRenderedVoice(context, bass, bassVoice)
  return { trebleVoice, bassVoice }
}

function buildRenderedVoice(events: ScoreEvent[], clef: 'treble' | 'bass'): RenderedVoice {
  const notes = events.map(event => buildStaveNote(event, clef))
  const voice = new Voice({ numBeats: 4, beatValue: 4 }).addTickables(notes)
  const beams = Beam.generateBeams(notes)
  return { events, notes, voice, beams }
}

function drawRenderedVoice(
  context: ReturnType<Renderer['getContext']>,
  stave: Stave,
  renderedVoice: RenderedVoice,
): void {
  renderedVoice.voice.draw(context, stave)
  renderedVoice.beams.forEach(beam => beam.setContext(context).draw())
}

function drawVoiceTies(
  context: ReturnType<Renderer['getContext']>,
  voices: RenderedVoice[],
): void {
  const renderedEvents = voices.flatMap(voice => voice.events.map((event, index) => ({
    event,
    note: voice.notes[index]!,
  })))

  renderedEvents.forEach(({ event, note }, index) => {
    if (event.pitches.length === 0) {
      return
    }

    const previous = renderedEvents[index - 1]
    const next = renderedEvents[index + 1]
    const indexes = event.pitches.map((_, pitchIndex) => pitchIndex)
    const hasConnectedPrevious = event.tieFromPrevious
      && previous?.event.tieToNext
      && samePitches(previous.event.pitches, event.pitches)

    if (event.tieFromPrevious && !hasConnectedPrevious) {
      drawTie(context, undefined, note, indexes)
    }

    if (!event.tieToNext) {
      return
    }

    const connectedNext = next?.event.tieFromPrevious
      && samePitches(event.pitches, next.event.pitches)
      ? next.note
      : undefined
    drawTie(context, note, connectedNext, indexes)
  })
}

function drawTie(
  context: ReturnType<Renderer['getContext']>,
  firstNote: StaveNote | undefined,
  lastNote: StaveNote | undefined,
  indexes: number[],
): void {
  new StaveTie({
    firstNote,
    lastNote,
    firstIndexes: indexes,
    lastIndexes: indexes,
  }).setContext(context).draw()
}

function samePitches(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((pitch, index) => pitch === right[index])
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
    keys.forEach((_, index) => {
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
  const duration = { 4: 'w', 2: 'h', 1: 'q', 0.5: '8' }[durationBeats]
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
