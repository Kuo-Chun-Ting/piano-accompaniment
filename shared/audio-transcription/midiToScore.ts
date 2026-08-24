import type {
  ScoreEvent,
  ScoreLyricCue,
  ScoreMeasure,
  ScoreNote,
  ScorePedalInterval,
  ScoreStaff,
  ScoreVersion,
} from '../arrangement/types'
import type {
  TranscribedLyricSegment,
  TranscribedNote,
  TranscribedPedalEvent,
  TranscriptionInput,
} from './types'
import { inferKeySignature, type PitchSpelling } from './keySignature'

const BEATS_PER_MEASURE = 4
const CELLS_PER_BEAT = 2
const CELLS_PER_MEASURE = BEATS_PER_MEASURE * CELLS_PER_BEAT
const PREFERRED_HAND_SPAN_SEMITONES = 12
const MIDDLE_C_MIDI = 60
const SHARP_NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
const FLAT_NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const

type QuantizedNote = {
  midi: number
  startCell: number
  endCell: number
}

type AssignedNote = QuantizedNote & {
  staffId: ScoreStaff['id']
}

type OnsetGroups = Map<number, QuantizedNote[]>

type MeasureNote = QuantizedNote & {
  startCell: number
  endCell: number
  tieFromPrevious: boolean
  tieToNext: boolean
}

export function convertTranscriptionToScore(input: TranscriptionInput): ScoreVersion {
  validateInput(input)

  const originSeconds = input.firstDownbeatSeconds ?? 0
  const availableSeconds = Math.max(input.durationSeconds - originSeconds, 0)
  const availableBeats = availableSeconds * input.bpm / 60
  const inferredMeasureCount = Math.max(1, Math.ceil(availableBeats / BEATS_PER_MEASURE))
  const measureCount = Math.max(
    input.measureCount ?? inferredMeasureCount,
    getRequiredMeasureCount(input.notes, input.bpm, originSeconds),
  )
  const totalCells = measureCount * CELLS_PER_MEASURE
  const onsetGroups = groupNotesByOnset(input.notes, input.bpm, originSeconds, totalCells)
  const quantizedNotes = truncateNotesAtRepeatedAttack([...onsetGroups.values()].flat())
  const assignedNotes = assignNotesToStaves(quantizedNotes)
  const keySignature = inferKeySignature(input.notes)
  const pedalIntervals = buildPedalIntervals(
    input.pedalEvents ?? [],
    input.bpm,
    originSeconds,
    measureCount * BEATS_PER_MEASURE,
  )
  const lyricsByMeasure = buildLyricsByMeasure(
    input.lyricSegments ?? [],
    input.bpm,
    originSeconds,
    measureCount,
    input.downbeatSeconds,
  )

  return {
    level: 'rich',
    keySignature: keySignature.name,
    measures: Array.from({ length: measureCount }, (_, measureIndex) =>
      buildMeasure(
        measureIndex,
        assignedNotes,
        keySignature.spelling,
        lyricsByMeasure.get(measureIndex) ?? [],
      )),
    ...(pedalIntervals.length > 0 ? { pedalIntervals } : {}),
  }
}

function buildLyricsByMeasure(
  segments: TranscribedLyricSegment[],
  bpm: number,
  originSeconds: number,
  measureCount: number,
  downbeatSeconds: number[] | undefined,
): Map<number, ScoreLyricCue[]> {
  const result = new Map<number, ScoreLyricCue[]>()

  for (const segment of [...segments].sort((left, right) => left.startSeconds - right.startSeconds)) {
    const text = segment.text.trim()
    const position = locateLyricPosition(
      segment.startSeconds,
      bpm,
      originSeconds,
      measureCount,
      downbeatSeconds,
    )
    if (!text
      || !Number.isFinite(segment.startSeconds)
      || !Number.isFinite(segment.endSeconds)
      || segment.endSeconds <= segment.startSeconds
      || !position) {
      continue
    }

    const cues = result.get(position.measureIndex) ?? []
    cues.push({
      startBeat: position.startBeat,
      text,
    })
    result.set(position.measureIndex, cues)
  }

  return result
}

function locateLyricPosition(
  startSeconds: number,
  bpm: number,
  originSeconds: number,
  measureCount: number,
  downbeatSeconds: number[] | undefined,
): { measureIndex: number, startBeat: number } | null {
  if (!Number.isFinite(startSeconds) || startSeconds < originSeconds) {
    return null
  }

  const detectedMeasureIndex = downbeatSeconds
    ? findLatestTimeIndex(downbeatSeconds, startSeconds)
    : 0
  if (detectedMeasureIndex < 0) {
    return null
  }

  const measureStartSeconds = downbeatSeconds?.[detectedMeasureIndex] ?? originSeconds
  const nextMeasureSeconds = downbeatSeconds?.[detectedMeasureIndex + 1]
  const beatOffset = nextMeasureSeconds === undefined
    ? (startSeconds - measureStartSeconds) * bpm / 60
    : (startSeconds - measureStartSeconds) / (nextMeasureSeconds - measureStartSeconds)
      * BEATS_PER_MEASURE
  const quantizedBeatOffset = Math.round(beatOffset * CELLS_PER_BEAT) / CELLS_PER_BEAT
  const measureIndex = detectedMeasureIndex
    + Math.floor(quantizedBeatOffset / BEATS_PER_MEASURE)
  if (measureIndex >= measureCount) {
    return null
  }

  return {
    measureIndex,
    startBeat: 1 + quantizedBeatOffset % BEATS_PER_MEASURE,
  }
}

function findLatestTimeIndex(times: number[], target: number): number {
  let result = -1
  for (let index = 0; index < times.length && times[index]! <= target; index += 1) {
    result = index
  }
  return result
}

export function midiNumberToPitch(midi: number, spelling: PitchSpelling = 'sharp'): string {
  if (!Number.isInteger(midi) || midi < 0 || midi > 127) {
    throw new Error(`Invalid MIDI note number: ${midi}`)
  }

  const noteNames = spelling === 'flat' ? FLAT_NOTE_NAMES : SHARP_NOTE_NAMES
  const noteName = noteNames[midi % noteNames.length]
  const octave = Math.floor(midi / noteNames.length) - 1
  return `${noteName}${octave}`
}

function getRequiredMeasureCount(
  notes: TranscribedNote[],
  bpm: number,
  originSeconds: number,
): number {
  const latestEndSeconds = notes
    .filter(isValidNote)
    .reduce((latest, note) => Math.max(latest, note.endSeconds), originSeconds)
  const contentBeats = Math.max(latestEndSeconds - originSeconds, 0) * bpm / 60
  return Math.max(1, Math.ceil(contentBeats / BEATS_PER_MEASURE))
}

function validateInput(input: TranscriptionInput): void {
  if (!Number.isFinite(input.bpm) || input.bpm <= 0) {
    throw new Error(`Invalid transcription BPM: ${input.bpm}`)
  }
  if (!Number.isFinite(input.durationSeconds) || input.durationSeconds <= 0) {
    throw new Error(`Invalid transcription duration: ${input.durationSeconds}`)
  }

  const originSeconds = input.firstDownbeatSeconds ?? 0
  if (!Number.isFinite(originSeconds) || originSeconds < 0 || originSeconds >= input.durationSeconds) {
    throw new Error(`Invalid first downbeat: ${originSeconds}`)
  }
  if (input.measureCount !== undefined
    && (!Number.isInteger(input.measureCount) || input.measureCount <= 0)) {
    throw new Error(`Invalid measure count: ${input.measureCount}`)
  }
}

function buildPedalIntervals(
  events: TranscribedPedalEvent[],
  bpm: number,
  originSeconds: number,
  totalBeats: number,
): ScorePedalInterval[] {
  const intervals: ScorePedalInterval[] = []
  let pedalDownSeconds: number | null = null

  for (const event of [...events].sort((left, right) => left.timeSeconds - right.timeSeconds)) {
    if (!isValidPedalEvent(event)) {
      continue
    }
    if (event.value >= 64) {
      pedalDownSeconds ??= event.timeSeconds
      continue
    }
    if (pedalDownSeconds === null) {
      continue
    }

    appendPedalInterval(intervals, pedalDownSeconds, event.timeSeconds, bpm, originSeconds, totalBeats)
    pedalDownSeconds = null
  }

  if (pedalDownSeconds !== null) {
    const scoreEndSeconds = originSeconds + totalBeats * 60 / bpm
    appendPedalInterval(intervals, pedalDownSeconds, scoreEndSeconds, bpm, originSeconds, totalBeats)
  }

  return intervals
}

function appendPedalInterval(
  intervals: ScorePedalInterval[],
  startSeconds: number,
  endSeconds: number,
  bpm: number,
  originSeconds: number,
  totalBeats: number,
): void {
  const startBeatOffset = clamp((startSeconds - originSeconds) * bpm / 60, 0, totalBeats)
  const endBeatOffset = clamp((endSeconds - originSeconds) * bpm / 60, 0, totalBeats)
  if (endBeatOffset > startBeatOffset) {
    intervals.push({ startBeatOffset, endBeatOffset })
  }
}

function isValidPedalEvent(event: TranscribedPedalEvent): boolean {
  return Number.isFinite(event.timeSeconds)
    && Number.isInteger(event.value)
    && event.value >= 0
    && event.value <= 127
}

function groupNotesByOnset(
  notes: TranscribedNote[],
  bpm: number,
  originSeconds: number,
  totalCells: number,
): OnsetGroups {
  const groups: OnsetGroups = new Map()

  for (const note of notes) {
    const quantized = quantizeNote(note, bpm, originSeconds, totalCells)
    if (!quantized) {
      continue
    }

    const group = groups.get(quantized.startCell) ?? []
    const duplicate = group.find(candidate => candidate.midi === quantized.midi)
    if (duplicate) {
      duplicate.endCell = Math.max(duplicate.endCell, quantized.endCell)
    } else {
      group.push(quantized)
      groups.set(quantized.startCell, group)
    }
  }

  return groups
}

function quantizeNote(
  note: TranscribedNote,
  bpm: number,
  originSeconds: number,
  totalCells: number,
): QuantizedNote | null {
  if (!isValidNote(note)) {
    return null
  }

  const startBeat = (note.startSeconds - originSeconds) * bpm / 60
  const endBeat = (note.endSeconds - originSeconds) * bpm / 60
  if (endBeat <= 0 || startBeat >= totalCells / CELLS_PER_BEAT) {
    return null
  }

  const startCell = clamp(Math.round(startBeat * CELLS_PER_BEAT), 0, totalCells - 1)
  const endCell = clamp(
    Math.max(startCell + 1, Math.round(endBeat * CELLS_PER_BEAT)),
    1,
    totalCells,
  )

  return { midi: note.midi, startCell, endCell }
}

function isValidNote(note: TranscribedNote): boolean {
  return Number.isInteger(note.midi)
    && note.midi >= 0
    && note.midi <= 127
    && Number.isFinite(note.startSeconds)
    && Number.isFinite(note.endSeconds)
    && note.endSeconds > note.startSeconds
}

function buildMeasure(
  measureIndex: number,
  notes: AssignedNote[],
  spelling: PitchSpelling,
  lyrics: ScoreLyricCue[],
): ScoreMeasure {
  return {
    sectionId: 'transcription',
    sectionLabel: 'Transcription',
    index: measureIndex + 1,
    chordSymbols: [],
    lyrics,
    intensity: 'medium',
    staves: [
      buildMeasureStaff('treble', measureIndex, notes, spelling),
      buildMeasureStaff('bass', measureIndex, notes, spelling),
    ],
  }
}

function buildMeasureStaff(
  clef: ScoreStaff['clef'],
  measureIndex: number,
  notes: AssignedNote[],
  spelling: PitchSpelling,
): ScoreStaff {
  const measureStart = measureIndex * CELLS_PER_MEASURE
  const measureEnd = measureStart + CELLS_PER_MEASURE
  const measureNotes = notes
    .filter(note => note.staffId === clef)
    .filter(note => note.startCell < measureEnd && note.endCell > measureStart)
    .map((note): MeasureNote => ({
      ...note,
      startCell: Math.max(note.startCell, measureStart),
      endCell: Math.min(note.endCell, measureEnd),
      tieFromPrevious: note.startCell < measureStart,
      tieToNext: note.endCell > measureEnd,
    }))
  const voices = [{
    id: `${clef}-1`,
    events: buildTimelineEvents(measureNotes, measureStart, measureEnd, spelling),
  }]

  return { id: clef, clef, voices }
}

function assignNotesToStaves(notes: QuantizedNote[]): AssignedNote[] {
  const conflicts = notes.map(() => [] as number[])
  notes.forEach((note, noteIndex) => {
    for (let candidateIndex = noteIndex + 1; candidateIndex < notes.length; candidateIndex += 1) {
      const candidate = notes[candidateIndex]!
      const overlaps = note.startCell < candidate.endCell && candidate.startCell < note.endCell
      if (overlaps && Math.abs(note.midi - candidate.midi) > PREFERRED_HAND_SPAN_SEMITONES) {
        conflicts[noteIndex]!.push(candidateIndex)
        conflicts[candidateIndex]!.push(noteIndex)
      }
    }
  })

  const staffByNote = new Array<ScoreStaff['id']>(notes.length)
  const colors = new Array<0 | 1 | undefined>(notes.length)

  notes.forEach((_, rootIndex) => {
    if (colors[rootIndex] !== undefined) {
      return
    }

    const component: number[] = []
    const queue = [rootIndex]
    colors[rootIndex] = 0
    let isBipartite = true

    for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
      const noteIndex = queue[queueIndex]!
      component.push(noteIndex)
      for (const candidateIndex of conflicts[noteIndex]!) {
        if (colors[candidateIndex] === undefined) {
          colors[candidateIndex] = colors[noteIndex] === 0 ? 1 : 0
          queue.push(candidateIndex)
        } else if (colors[candidateIndex] === colors[noteIndex]) {
          isBipartite = false
        }
      }
    }

    if (!isBipartite) {
      component.forEach((noteIndex) => {
        staffByNote[noteIndex] = notes[noteIndex]!.midi <= MIDDLE_C_MIDI ? 'bass' : 'treble'
      })
      return
    }

    const normalCost = getComponentRegisterCost(component, colors, notes, false)
    const reversedCost = getComponentRegisterCost(component, colors, notes, true)
    const reverse = reversedCost < normalCost
    component.forEach((noteIndex) => {
      const color = colors[noteIndex]!
      staffByNote[noteIndex] = (color === Number(reverse)) ? 'bass' : 'treble'
    })
  })

  return notes.map((note, index) => ({ ...note, staffId: staffByNote[index]! }))
}

function getComponentRegisterCost(
  component: number[],
  colors: Array<0 | 1 | undefined>,
  notes: QuantizedNote[],
  reverse: boolean,
): number {
  return component.reduce((total, noteIndex) => {
    const midi = notes[noteIndex]!.midi
    const isBass = colors[noteIndex] === Number(reverse)
    const penalty = isBass
      ? Math.max(0, midi - MIDDLE_C_MIDI) ** 2
      : Math.max(0, MIDDLE_C_MIDI + 1 - midi) ** 2
    return total + penalty
  }, 0)
}

function truncateNotesAtRepeatedAttack(notes: QuantizedNote[]): QuantizedNote[] {
  const byMidi = new Map<number, QuantizedNote[]>()
  for (const note of notes) {
    byMidi.set(note.midi, [...(byMidi.get(note.midi) ?? []), note])
  }

  for (const matchingNotes of byMidi.values()) {
    matchingNotes.sort((left, right) => left.startCell - right.startCell)
    matchingNotes.forEach((note, index) => {
      const nextAttack = matchingNotes[index + 1]?.startCell
      if (nextAttack !== undefined && note.endCell > nextAttack) {
        note.endCell = nextAttack
      }
    })
  }
  return notes.filter(note => note.endCell > note.startCell)
}

function buildTimelineEvents(
  notes: MeasureNote[],
  measureStart: number,
  measureEnd: number,
  spelling: PitchSpelling,
): ScoreEvent[] {
  const boundaries = [...new Set([
    measureStart,
    measureEnd,
    ...notes.flatMap(note => [note.startCell, note.endCell]),
  ])].sort((left, right) => left - right)
  const events: ScoreEvent[] = []

  for (let boundaryIndex = 0; boundaryIndex < boundaries.length - 1; boundaryIndex += 1) {
    let cursor = boundaries[boundaryIndex]!
    const boundaryEnd = boundaries[boundaryIndex + 1]!
    while (cursor < boundaryEnd) {
      const durationCells = nextSupportedDuration(boundaryEnd - cursor)
      const segmentEnd = cursor + durationCells
      const activeNotes = notes
        .filter(note => note.startCell <= cursor && note.endCell >= segmentEnd)
        .sort((left, right) => left.midi - right.midi)
      const scoreNotes = activeNotes.map((note): ScoreNote => ({
        pitch: midiNumberToPitch(note.midi, spelling),
        ...(note.tieFromPrevious || cursor > note.startCell ? { tieFromPrevious: true } : {}),
        ...(note.tieToNext || segmentEnd < note.endCell ? { tieToNext: true } : {}),
      }))
      events.push({
        startBeat: 1 + (cursor - measureStart) / CELLS_PER_BEAT,
        durationBeats: durationCells / CELLS_PER_BEAT,
        notes: scoreNotes,
      })
      cursor = segmentEnd
    }
  }

  return events
}

function nextSupportedDuration(remainingCells: number): number {
  if (remainingCells >= 8) {
    return 8
  }
  if (remainingCells >= 4) {
    return 4
  }
  if (remainingCells >= 2) {
    return 2
  }
  return 1
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum)
}
