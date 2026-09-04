<script setup lang="ts">
import {
  Accidental,
  Beam,
  Dot,
  Formatter,
  FretHandFinger,
  GhostNote,
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
  ScorePedalInterval,
  ScoreStaff,
} from '~/shared/arrangement/types'
import {
  getScoreCueX,
  SCORE_SYSTEM_LAYOUT,
} from '~/shared/ui/scoreLayout'
import type { ScoreSystem } from '~/shared/ui/scoreSystems'
import { fitTextWithinBounds, getScoreSystemMeasureWidths } from '~/shared/ui/scoreSystems'

const props = defineProps<{
  system: ScoreSystem
  keySignature?: ScoreKeySignature
  pedalIntervals?: ScorePedalInterval[]
}>()

const container = ref<HTMLDivElement | null>(null)
let resizeObserver: ResizeObserver | null = null
let layoutFrame: number | null = null

type RenderedVoice = {
  id: string
  events: ScoreEvent[]
  notes: Array<StaveNote | undefined>
  voice: Voice
  beams: Beam[]
}

onMounted(() => {
  resizeObserver = new ResizeObserver(renderSystem)
  resizeObserver.observe(container.value!)
  renderSystem()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  if (layoutFrame !== null) {
    cancelAnimationFrame(layoutFrame)
  }
})
watch(() => props.system, () => nextTick(renderSystem), { deep: true })

function renderSystem(): void {
  if (!container.value || props.system.measures.length === 0) {
    return
  }

  container.value.innerHTML = ''
  container.value.dataset.layoutReady = 'false'
  if (layoutFrame !== null) {
    cancelAnimationFrame(layoutFrame)
  }
  const width = Math.max(container.value.clientWidth, 760)
  const renderer = new Renderer(container.value, Renderer.Backends.SVG)
  renderer.resize(width, SCORE_SYSTEM_LAYOUT.height)
  const context = renderer.getContext()
  const outerPadding = 16
  const measureWidths = getScoreSystemMeasureWidths(props.system, width - outerPadding * 2)
  let nextMeasureX = outerPadding
  context.openGroup('score-notation')
  const staves = props.system.measures.map((measure, measureIndex) => {
    const x = nextMeasureX
    const measureWidth = measureWidths[measureIndex]!
    nextMeasureX += measureWidth
    const treble = new Stave(x, SCORE_SYSTEM_LAYOUT.trebleStaveY, measureWidth)
    const bass = new Stave(x, SCORE_SYSTEM_LAYOUT.bassStaveY, measureWidth)

    if (measureIndex === 0) {
      treble.addClef('treble').addKeySignature(props.keySignature ?? 'C')
      bass.addClef('bass').addKeySignature(props.keySignature ?? 'C')
      if (props.system.startMeasureIndex === 0) {
        treble.addTimeSignature('4/4')
        bass.addTimeSignature('4/4')
      }
    }

    treble.setContext(context).draw()
    bass.setContext(context).draw()
    const trebleStaff = getScoreStaff(measure.staves, 'treble')
    const bassStaff = getScoreStaff(measure.staves, 'bass')
    const { trebleVoices, bassVoices } = drawGrandStaffVoices(
      context,
      treble,
      bass,
      trebleStaff,
      bassStaff,
      measureWidth,
    )
    drawChordSymbols(context, treble, trebleStaff, measureWidth, x)

    return { treble, bass, trebleVoices, bassVoices, measure, measureWidth, x }
  })

  drawStaffTies(context, staves.map(stave => stave.trebleVoices))
  drawStaffTies(context, staves.map(stave => stave.bassVoices))

  const first = staves[0]
  const last = staves.at(-1)
  if (first) {
    drawConnector(context, first.treble, first.bass, 'brace')
    drawConnector(context, first.treble, first.bass, 'singleLeft')
  }
  if (last) {
    drawConnector(context, last.treble, last.bass, 'singleRight')
  }
  context.closeGroup()

  layoutFrame = requestAnimationFrame(() => {
    layoutFrame = null
    const notationBottom = getSvgContentBottom(
      '.vf-score-notation',
      SCORE_SYSTEM_LAYOUT.bassStaveY + 80,
    )
    const pedalBottom = drawPedalMarkings(
      context,
      staves.map(stave => stave.bass),
      notationBottom + 20,
    )
      ? getSvgContentBottom('.vf-pedal-marking', notationBottom)
      : notationBottom
    const lyricBaselineY = Math.max(notationBottom, pedalBottom) + 28
    staves.forEach(stave => drawLyrics(
      context,
      stave.bass,
      stave.measure.lyrics,
      stave.measureWidth,
      stave.x,
      lyricBaselineY,
    ))
    const contentBottom = getSvgContentBottom(
      '.vf-score-lyrics',
      Math.max(notationBottom, pedalBottom),
    )
    renderer.resize(width, Math.max(SCORE_SYSTEM_LAYOUT.height, contentBottom + 20))
    if (container.value) {
      container.value.dataset.layoutReady = 'true'
    }
  })
}

function drawLyrics(
  context: ReturnType<Renderer['getContext']>,
  bass: Stave,
  lyrics: ScoreLyricCue[],
  staveWidth: number,
  staveX: number,
  baselineY: number,
): void {
  if (lyrics.length === 0) {
    return
  }

  const noteStartX = bass.getNoteStartX()
  const noteEndX = staveX + staveWidth - 12
  context.openGroup('score-lyrics')
  context.setFont('Iowan Old Style, "Noto Serif TC", serif', 13, 400)
  lyrics.forEach((lyric) => {
    const preferredX = getScoreCueX(lyric.startBeat, noteStartX, noteEndX)
    const textWidth = context.measureText(lyric.text).width
    context.fillText(
      lyric.text,
      fitTextWithinBounds(preferredX, textWidth, staveX + 12, noteEndX),
      baselineY,
    )
  })
  context.closeGroup()
}

function drawChordSymbols(
  context: ReturnType<Renderer['getContext']>,
  treble: Stave,
  staff: ScoreStaff,
  staveWidth: number,
  staveX: number,
): void {
  const chordEvents = staff.voices.flatMap(voice => voice.events)
    .filter(event => event.chordSymbol)
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
  trebleStaff: ScoreStaff,
  bassStaff: ScoreStaff,
  staveWidth: number,
): { trebleVoices: RenderedVoice[], bassVoices: RenderedVoice[] } {
  const trebleVoices = buildRenderedVoices(trebleStaff)
  const bassVoices = buildRenderedVoices(bassStaff)
  Accidental.applyAccidentals(trebleVoices.map(voice => voice.voice), props.keySignature ?? 'C')
  Accidental.applyAccidentals(bassVoices.map(voice => voice.voice), props.keySignature ?? 'C')
  const voices = [...trebleVoices, ...bassVoices].map(rendered => rendered.voice)
  const formatter = new Formatter()
    .joinVoices(trebleVoices.map(voice => voice.voice))
    .joinVoices(bassVoices.map(voice => voice.voice))
  const noteStartX = Math.max(treble.getNoteStartX(), bass.getNoteStartX())
  const noteEndX = treble.getX() + staveWidth - 16
  const formattingWidth = Math.max(noteEndX - noteStartX, 100)
  formatter.format(voices, formattingWidth)

  trebleVoices.forEach(voice => drawRenderedVoice(context, treble, voice))
  bassVoices.forEach(voice => drawRenderedVoice(context, bass, voice))
  return { trebleVoices, bassVoices }
}

function getScoreStaff(staves: ScoreStaff[], clef: ScoreStaff['clef']): ScoreStaff {
  const staff = staves.find(candidate => candidate.clef === clef)
  if (!staff) {
    throw new Error(`Score measure is missing the ${clef} staff`)
  }
  return staff
}

function buildRenderedVoices(staff: ScoreStaff): RenderedVoice[] {
  return staff.voices.map((voice, index) =>
    buildRenderedVoice(voice.id, voice.events, staff.clef, staff.voices.length, index))
}

function buildRenderedVoice(
  id: string,
  events: ScoreEvent[],
  clef: ScoreStaff['clef'],
  voiceCount: number,
  voiceIndex: number,
): RenderedVoice {
  const tickables = events.map(event => event.isSpacer
    ? new GhostNote({ duration: toVexDuration(event.durationBeats) })
    : buildStaveNote(event, clef, voiceCount, voiceIndex))
  const notes = tickables.map(tickable => tickable instanceof StaveNote ? tickable : undefined)
  const voice = new Voice({ numBeats: 4, beatValue: 4 }).addTickables(tickables)
  const beams = Beam.generateBeams(tickables)
  return { id, events, notes, voice, beams }
}

function drawRenderedVoice(
  context: ReturnType<Renderer['getContext']>,
  stave: Stave,
  renderedVoice: RenderedVoice,
): void {
  renderedVoice.voice.draw(context, stave)
  renderedVoice.beams.forEach(beam => beam.setContext(context).draw())
}

function drawStaffTies(
  context: ReturnType<Renderer['getContext']>,
  measures: RenderedVoice[][],
): void {
  const renderedEvents = measures.flatMap((voices, measureIndex) =>
    voices.flatMap(voice => voice.events.map((event, eventIndex) => ({
      event,
      note: voice.notes[eventIndex]!,
      startBeatOffset: measureIndex * 4 + event.startBeat - 1,
      endBeatOffset: measureIndex * 4 + event.startBeat - 1 + event.durationBeats,
    }))))

  for (const current of renderedEvents) {
    if (!current.note) {
      continue
    }
    current.event.notes.forEach((scoreNote, noteIndex) => {
      if (scoreNote.tieFromPrevious) {
        const previous = renderedEvents.find(candidate =>
          candidate.endBeatOffset === current.startBeatOffset
          && candidate.event.notes.some(note => note.pitch === scoreNote.pitch && note.tieToNext))
        if (!previous?.note) {
          drawTie(context, undefined, current.note, [noteIndex], [noteIndex])
        }
      }

      if (!scoreNote.tieToNext) {
        return
      }
      const next = renderedEvents.find(candidate =>
        candidate.startBeatOffset === current.endBeatOffset
        && candidate.event.notes.some(note => note.pitch === scoreNote.pitch && note.tieFromPrevious))
      if (!next?.note) {
        drawTie(context, current.note, undefined, [noteIndex], [noteIndex])
        return
      }
      const nextIndex = next.event.notes.findIndex(note => note.pitch === scoreNote.pitch)
      drawTie(context, current.note, next.note, [noteIndex], [nextIndex])
    })
  }
}

function drawTie(
  context: ReturnType<Renderer['getContext']>,
  firstNote: StaveNote | undefined,
  lastNote: StaveNote | undefined,
  firstIndexes: number[],
  lastIndexes: number[],
): void {
  new StaveTie({
    firstNote,
    lastNote,
    firstIndexes,
    lastIndexes,
  }).setContext(context).draw()
}

function drawPedalMarkings(
  context: ReturnType<Renderer['getContext']>,
  bassStaves: Stave[],
  baselineY: number,
): boolean {
  const systemStartBeat = props.system.startMeasureIndex * 4
  const systemEndBeat = systemStartBeat + props.system.measures.length * 4
  let rendered = false

  for (const interval of props.pedalIntervals ?? []) {
    if (interval.endBeatOffset <= systemStartBeat || interval.startBeatOffset >= systemEndBeat) {
      continue
    }

    const visibleStartBeat = Math.max(interval.startBeatOffset, systemStartBeat)
    const visibleEndBeat = Math.min(interval.endBeatOffset, systemEndBeat)
    const isClippedAtSystemBoundary = visibleStartBeat !== interval.startBeatOffset
      || visibleEndBeat !== interval.endBeatOffset
    if (isClippedAtSystemBoundary && visibleEndBeat - visibleStartBeat < 0.5) {
      continue
    }

    const startX = getPedalX(visibleStartBeat, bassStaves)
    const endX = getPedalX(visibleEndBeat, bassStaves)
    context.openGroup('pedal-marking')
    context.setLineWidth(1.25)
    context.beginPath()
    context.moveTo(startX, baselineY - 8)
    context.lineTo(startX, baselineY)
    context.lineTo(endX, baselineY)
    context.lineTo(endX, baselineY - 8)
    context.stroke()
    context.closeGroup()
    rendered = true
  }

  return rendered
}

function getSvgContentBottom(selector: string, fallback: number): number {
  const elements = container.value?.querySelectorAll<SVGGraphicsElement>(selector) ?? []
  let bottom = fallback

  for (const element of elements) {
    if (typeof element.getBBox !== 'function') {
      continue
    }
    const box = element.getBBox()
    bottom = Math.max(bottom, box.y + box.height)
  }

  return bottom
}

function getPedalX(absoluteBeatOffset: number, bassStaves: Stave[]): number {
  const relativeBeat = absoluteBeatOffset - props.system.startMeasureIndex * 4
  const measureIndex = Math.min(Math.floor(relativeBeat / 4), bassStaves.length - 1)
  const beatInMeasure = measureIndex === bassStaves.length - 1 && relativeBeat === bassStaves.length * 4
    ? 5
    : relativeBeat - measureIndex * 4 + 1
  const stave = bassStaves[measureIndex]!
  return getScoreCueX(beatInMeasure, stave.getNoteStartX(), stave.getX() + stave.getWidth() - 12)
}

function buildStaveNote(
  event: ScoreEvent,
  clef: ScoreStaff['clef'],
  voiceCount: number,
  voiceIndex: number,
): StaveNote {
  const isRest = event.notes.length === 0
  const keys = isRest ? [clef === 'treble' ? 'b/4' : 'd/3'] : event.notes.map(note => toVexPitch(note.pitch))
  const duration = toVexDuration(event.durationBeats)
  const note = new StaveNote({
    clef,
    keys,
    duration: `${duration}${isRest ? 'r' : ''}`,
  })
  if (duration.endsWith('d')) {
    Dot.buildAndAttach([note], isRest ? undefined : { all: true })
  }
  if (voiceCount > 1) {
    note.setStemDirection(voiceIndex % 2 === 0 ? 1 : -1)
  }

  if (!isRest) {
    keys.forEach((_, index) => {
      const finger = event.notes[index]?.finger
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
  const duration = {
    4: 'w',
    3: 'hd',
    2: 'h',
    1.5: 'qd',
    1: 'q',
    0.75: '8d',
    0.5: '8',
    0.25: '16',
  }[durationBeats]
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
