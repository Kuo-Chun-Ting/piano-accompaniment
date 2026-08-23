import type {
  ScoreEvent,
  ScoreLyricCue,
  ScoreMeasure,
  ScorePedalInterval,
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
const HAND_SPLIT_MIDI = 60
const SHARP_NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
const FLAT_NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const

type QuantizedNote = {
  midi: number
  startCell: number
  endCell: number
}

type ScoreGridCell = {
  attacks: Set<number>
  pitches: Set<number>
}

type OnsetGroups = Map<number, QuantizedNote[]>

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
  const { leftGroups, rightGroups } = splitOnsetsBetweenHands(onsetGroups)
  const leftGrid = buildHandGrid(leftGroups, totalCells)
  const rightGrid = buildHandGrid(rightGroups, totalCells)
  const keySignature = inferKeySignature(input.notes)
  const playbackNotes = buildPlaybackNotes(
    input.notes,
    input.bpm,
    originSeconds,
    measureCount * BEATS_PER_MEASURE,
    keySignature.spelling,
  )
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
    playbackNotes,
    measures: Array.from({ length: measureCount }, (_, measureIndex) =>
      buildMeasure(
        measureIndex,
        leftGrid,
        rightGrid,
        keySignature.spelling,
        lyricsByMeasure.get(measureIndex) ?? [],
      )),
    ...(pedalIntervals.length > 0 ? { pedalIntervals } : {}),
  }
}

function buildPlaybackNotes(
  notes: TranscribedNote[],
  bpm: number,
  originSeconds: number,
  totalBeats: number,
  spelling: PitchSpelling,
) {
  return notes.flatMap((note) => {
    if (!isValidNote(note) || note.endSeconds <= originSeconds) {
      return []
    }

    const startBeatOffset = Math.max(0, (note.startSeconds - originSeconds) * bpm / 60)
    const endBeatOffset = Math.min(totalBeats, (note.endSeconds - originSeconds) * bpm / 60)
    if (startBeatOffset >= totalBeats || endBeatOffset <= startBeatOffset) {
      return []
    }

    return [{
      pitch: midiNumberToPitch(note.midi, spelling),
      startBeatOffset,
      durationBeats: endBeatOffset - startBeatOffset,
      velocity: note.velocity,
    }]
  })
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

function splitOnsetsBetweenHands(onsetGroups: OnsetGroups): {
  leftGroups: OnsetGroups
  rightGroups: OnsetGroups
} {
  const leftGroups: OnsetGroups = new Map()
  const rightGroups: OnsetGroups = new Map()

  for (const [startCell, notes] of onsetGroups) {
    const sorted = [...notes].sort((left, right) => left.midi - right.midi)
    const splitIndex = findBestHandSplit(sorted)
    if (splitIndex > 0) {
      leftGroups.set(startCell, sorted.slice(0, splitIndex))
    }
    if (splitIndex < sorted.length) {
      rightGroups.set(startCell, sorted.slice(splitIndex))
    }
  }

  return { leftGroups, rightGroups }
}

function findBestHandSplit(notes: QuantizedNote[]): number {
  const firstRightHandNote = notes.findIndex(note => note.midi >= HAND_SPLIT_MIDI)
  return firstRightHandNote === -1 ? notes.length : firstRightHandNote
}

function buildHandGrid(onsetGroups: OnsetGroups, totalCells: number): ScoreGridCell[] {
  const grid = Array.from({ length: totalCells }, (): ScoreGridCell => ({
    attacks: new Set<number>(),
    pitches: new Set<number>(),
  }))

  for (const [startCell, notes] of onsetGroups) {
    for (const note of notes) {
      grid[startCell]!.attacks.add(note.midi)
      for (let cellIndex = startCell; cellIndex < note.endCell; cellIndex += 1) {
        grid[cellIndex]!.pitches.add(note.midi)
      }
    }
  }

  return grid
}

function buildMeasure(
  measureIndex: number,
  leftGrid: ScoreGridCell[],
  rightGrid: ScoreGridCell[],
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
    leftHand: buildMeasureEvents(leftGrid, measureIndex, spelling),
    rightHand: buildMeasureEvents(rightGrid, measureIndex, spelling),
  }
}

function buildMeasureEvents(
  grid: ScoreGridCell[],
  measureIndex: number,
  spelling: PitchSpelling,
): ScoreEvent[] {
  const measureStart = measureIndex * CELLS_PER_MEASURE
  const measureEnd = measureStart + CELLS_PER_MEASURE
  const events: ScoreEvent[] = []
  let cellIndex = measureStart

  while (cellIndex < measureEnd) {
    const pitches = sortedPitches(grid[cellIndex]?.pitches)
    let runEnd = cellIndex + 1

    while (runEnd < measureEnd
      && grid[runEnd]?.attacks.size === 0
      && samePitches(pitches, sortedPitches(grid[runEnd]?.pitches))) {
      runEnd += 1
    }

    let remainingCells = runEnd - cellIndex
    while (remainingCells > 0) {
      const durationCells = nextSupportedDuration(remainingCells)
      const eventEnd = cellIndex + durationCells
      const previousPitches = grid[cellIndex - 1]?.pitches
      const nextPitches = grid[eventEnd]?.pitches
      const tieFromPrevious = pitches.filter(pitch =>
        previousPitches?.has(pitch) && !grid[cellIndex]?.attacks.has(pitch))
      const tieToNext = pitches.filter(pitch =>
        nextPitches?.has(pitch) && !grid[eventEnd]?.attacks.has(pitch))
      const spelledPitches = pitches.map(midi => midiNumberToPitch(midi, spelling))
      const tieFromPreviousPitches = tieFromPrevious.map(midi => midiNumberToPitch(midi, spelling))
      const tieToNextPitches = tieToNext.map(midi => midiNumberToPitch(midi, spelling))

      events.push({
        startBeat: 1 + (cellIndex - measureStart) / CELLS_PER_BEAT,
        durationBeats: durationCells / CELLS_PER_BEAT,
        pitches: spelledPitches,
        fingers: [],
        tieToNext: tieToNext.length === pitches.length && pitches.length > 0,
        ...(tieFromPrevious.length === pitches.length && pitches.length > 0
          ? { tieFromPrevious: true }
          : {}),
        ...(tieFromPreviousPitches.length > 0 ? { tieFromPreviousPitches } : {}),
        ...(tieToNextPitches.length > 0 ? { tieToNextPitches } : {}),
      })

      cellIndex = eventEnd
      remainingCells -= durationCells
    }
  }

  return events
}

function sortedPitches(pitches: Set<number> | undefined): number[] {
  return pitches ? [...pitches].sort((left, right) => left - right) : []
}

function samePitches(left: number[], right: number[]): boolean {
  return left.length === right.length && left.every((pitch, index) => pitch === right[index])
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
