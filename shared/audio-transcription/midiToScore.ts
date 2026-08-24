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
export const SCORE_CELLS_PER_BEAT = 4
const LYRIC_CELLS_PER_BEAT = 2
const CELLS_PER_BEAT = SCORE_CELLS_PER_BEAT
const CELLS_PER_MEASURE = BEATS_PER_MEASURE * CELLS_PER_BEAT
const MAXIMUM_CHORD_ONSET_SPREAD_SECONDS = 0.1
const READABLE_SHORT_CHORD_DURATION_CELLS = [1, 2, 3, 4, 6, 8] as const
const PREFERRED_HAND_SPAN_SEMITONES = 12
const MIDDLE_C_MIDI = 60
const SHARP_NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
const FLAT_NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const

type QuantizedNote = {
  midi: number
  startCell: number
  endCell: number
  endSeconds: number
  onsetGroupId: number
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
  const toBeatOffset = buildBeatOffsetConverter(input.bpm, originSeconds, input.beatSeconds)
  const availableBeats = Math.max(toBeatOffset(input.durationSeconds), 0)
  const inferredMeasureCount = Math.max(1, Math.ceil(availableBeats / BEATS_PER_MEASURE))
  const measureCount = Math.max(
    input.measureCount ?? inferredMeasureCount,
    getRequiredMeasureCount(input.notes, toBeatOffset),
  )
  const totalCells = measureCount * CELLS_PER_MEASURE
  const onsetGroups = groupNotesByOnset(input.notes, toBeatOffset, totalCells)
  const keySignature = inferKeySignature(input.notes)
  const pedalIntervals = buildPedalIntervals(
    input.pedalEvents ?? [],
    toBeatOffset,
    measureCount * BEATS_PER_MEASURE,
  )
  const quantizedNotes = [...onsetGroups.values()].flat()
  const staffNotes = assignNotesToStaves(quantizedNotes)
  const normalizedNotes = normalizeChordDurations(staffNotes)
  const assignedNotes = truncateNotesAtRepeatedAttack(normalizedNotes)
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
  const quantizedBeatOffset = Math.round(beatOffset * LYRIC_CELLS_PER_BEAT) / LYRIC_CELLS_PER_BEAT
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
  toBeatOffset: (seconds: number) => number,
): number {
  const latestEndSeconds = notes
    .filter(isValidNote)
    .reduce((latest, note) => Math.max(latest, note.endSeconds), 0)
  const contentBeats = Math.max(toBeatOffset(latestEndSeconds), 0)
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
  toBeatOffset: (seconds: number) => number,
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

    appendPedalInterval(
      intervals,
      toBeatOffset(pedalDownSeconds),
      toBeatOffset(event.timeSeconds),
      totalBeats,
    )
    pedalDownSeconds = null
  }

  if (pedalDownSeconds !== null) {
    appendPedalInterval(intervals, toBeatOffset(pedalDownSeconds), totalBeats, totalBeats)
  }

  return intervals
}

function appendPedalInterval(
  intervals: ScorePedalInterval[],
  rawStartBeatOffset: number,
  rawEndBeatOffset: number,
  totalBeats: number,
): void {
  const startBeatOffset = clamp(rawStartBeatOffset, 0, totalBeats)
  const endBeatOffset = clamp(rawEndBeatOffset, 0, totalBeats)
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
  toBeatOffset: (seconds: number) => number,
  totalCells: number,
): OnsetGroups {
  const groups: OnsetGroups = new Map()
  const onsetGroups = groupTranscribedNotesByOnset(notes)
  let previousStartCell = -1

  for (const [onsetGroupId, onsetGroup] of onsetGroups.entries()) {
    const rawStartCell = Math.round(toBeatOffset(onsetGroup[0]!.startSeconds) * CELLS_PER_BEAT)
    const startCell = clamp(Math.max(rawStartCell, previousStartCell + 1), 0, totalCells - 1)
    const group = onsetGroup
      .map(note => quantizeNote(note, toBeatOffset, totalCells, startCell, onsetGroupId))
      .filter((note): note is QuantizedNote => note !== null)

    if (group.length > 0) {
      groups.set(onsetGroupId, mergeDuplicatePitches(group))
      previousStartCell = startCell
    }
  }

  return groups
}

export function groupTranscribedNotesByOnset(notes: TranscribedNote[]): TranscribedNote[][] {
  const groups: TranscribedNote[][] = []
  const sortedNotes = notes.filter(isValidNote)
    .sort((left, right) => left.startSeconds - right.startSeconds)

  for (const note of sortedNotes) {
    const currentGroup = groups.at(-1)
    const groupStartSeconds = currentGroup?.[0]?.startSeconds
    if (currentGroup
      && groupStartSeconds !== undefined
      && note.startSeconds - groupStartSeconds <= MAXIMUM_CHORD_ONSET_SPREAD_SECONDS) {
      currentGroup.push(note)
    } else {
      groups.push([note])
    }
  }
  return groups
}

function mergeDuplicatePitches(notes: QuantizedNote[]): QuantizedNote[] {
  const result: QuantizedNote[] = []
  for (const note of notes) {
    const duplicate = result.find(candidate => candidate.midi === note.midi)
    if (duplicate) {
      duplicate.endCell = Math.max(duplicate.endCell, note.endCell)
      duplicate.endSeconds = Math.max(duplicate.endSeconds, note.endSeconds)
    } else {
      result.push(note)
    }
  }
  return result
}

function quantizeNote(
  note: TranscribedNote,
  toBeatOffset: (seconds: number) => number,
  totalCells: number,
  startCell: number,
  onsetGroupId: number,
): QuantizedNote | null {
  if (!isValidNote(note)) {
    return null
  }

  const startBeat = toBeatOffset(note.startSeconds)
  const endBeat = toBeatOffset(note.endSeconds)
  if (endBeat <= 0 || startBeat >= totalCells / CELLS_PER_BEAT) {
    return null
  }

  const endCell = clamp(
    Math.max(startCell + 1, Math.round(endBeat * CELLS_PER_BEAT)),
    1,
    totalCells,
  )

  return { midi: note.midi, startCell, endCell, endSeconds: note.endSeconds, onsetGroupId }
}

export function buildBeatOffsetConverter(
  bpm: number,
  originSeconds: number,
  detectedBeats: number[] | undefined,
): (seconds: number) => number {
  const beatSeconds = [
    originSeconds,
    ...(detectedBeats ?? [])
      .filter(time => Number.isFinite(time) && time > originSeconds)
      .sort((left, right) => left - right),
  ]
  if (beatSeconds.length < 2) {
    return seconds => (seconds - originSeconds) * bpm / 60
  }

  return seconds => interpolateBeatOffset(seconds, beatSeconds, bpm)
}

function interpolateBeatOffset(seconds: number, beatSeconds: number[], bpm: number): number {
  const firstInterval = beatSeconds[1]! - beatSeconds[0]!
  if (seconds <= beatSeconds[0]!) {
    return (seconds - beatSeconds[0]!) / firstInterval
  }

  for (let index = 0; index < beatSeconds.length - 1; index += 1) {
    const start = beatSeconds[index]!
    const end = beatSeconds[index + 1]!
    if (seconds <= end) {
      return index + (seconds - start) / (end - start)
    }
  }

  const lastIndex = beatSeconds.length - 1
  const lastBeat = beatSeconds[lastIndex]!
  const previousBeat = beatSeconds[lastIndex - 1]!
  const fallbackInterval = 60 / bpm
  const interval = lastBeat > previousBeat ? lastBeat - previousBeat : fallbackInterval
  return lastIndex + (seconds - lastBeat) / interval
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
    events: simplifyTiedEvents(buildTimelineEvents(
      measureNotes,
      measureStart,
      measureEnd,
      spelling,
    )),
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

function normalizeChordDurations(
  notes: AssignedNote[],
): AssignedNote[] {
  const notesByAttack = new Map<string, AssignedNote[]>()
  for (const note of notes) {
    const key = `${note.staffId}:${note.onsetGroupId}`
    notesByAttack.set(key, [...(notesByAttack.get(key) ?? []), note])
  }

  const attackCellsByStaff = buildAttackCellsByStaff(notes)
  for (const attackNotes of notesByAttack.values()) {
    const staffId = attackNotes[0]!.staffId
    const startCell = attackNotes[0]!.startCell
    const nextAttackCell = attackCellsByStaff.get(staffId)
      ?.find(candidate => candidate > startCell)
    const commonEndCell = getMedianEndCell(attackNotes, nextAttackCell)
    const readableEndCell = getReadableChordEndCell(attackNotes, commonEndCell)

    attackNotes.forEach((note) => {
      note.endCell = readableEndCell
    })
  }
  return notes
}

function getReadableChordEndCell(notes: AssignedNote[], endCell: number): number {
  if (notes.length < 2) {
    return endCell
  }

  const startCell = notes[0]!.startCell
  const durationCells = endCell - startCell
  if (durationCells > READABLE_SHORT_CHORD_DURATION_CELLS.at(-1)!) {
    return endCell
  }

  const readableDuration = [...READABLE_SHORT_CHORD_DURATION_CELLS]
    .reverse()
    .find(candidate => candidate <= durationCells) ?? 1
  return startCell + readableDuration
}

function buildAttackCellsByStaff(notes: AssignedNote[]): Map<ScoreStaff['id'], number[]> {
  const result = new Map<ScoreStaff['id'], number[]>()
  for (const staffId of ['treble', 'bass'] as const) {
    result.set(staffId, [...new Set(notes
      .filter(note => note.staffId === staffId)
      .map(note => note.startCell))].sort((left, right) => left - right))
  }
  return result
}

function getMedianEndCell(notes: AssignedNote[], nextAttackCell: number | undefined): number {
  const endCells = notes.map(note => note.endCell).sort((left, right) => left - right)
  const medianEndCell = endCells[Math.floor(endCells.length / 2)]!
  return nextAttackCell === undefined ? medianEndCell : Math.min(medianEndCell, nextAttackCell)
}

function truncateNotesAtRepeatedAttack<T extends QuantizedNote>(notes: T[]): T[] {
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

export function simplifyTiedEvents(events: ScoreEvent[]): ScoreEvent[] {
  const simplified: ScoreEvent[] = []

  for (const event of events) {
    const previous = simplified.at(-1)
    if (!previous || !canMergeTiedEvents(previous, event)) {
      simplified.push(event)
      continue
    }

    simplified[simplified.length - 1] = mergeTiedEvents(previous, event)
  }

  return simplified
}

export function canMergeTiedEvents(first: ScoreEvent, second: ScoreEvent): boolean {
  const combinedDuration = first.durationBeats + second.durationBeats
  if (combinedDuration !== 1.5
    || ![1, 3].includes(first.startBeat)
    || first.startBeat + first.durationBeats !== second.startBeat
    || first.notes.length === 0
    || first.notes.length !== second.notes.length) {
    return false
  }

  return first.notes.every((note) => {
    const continuation = second.notes.find(candidate => candidate.pitch === note.pitch)
    return note.tieToNext === true && continuation?.tieFromPrevious === true
  })
}

function mergeTiedEvents(first: ScoreEvent, second: ScoreEvent): ScoreEvent {
  return {
    startBeat: first.startBeat,
    durationBeats: first.durationBeats + second.durationBeats,
    notes: first.notes.map((note): ScoreNote => {
      const continuation = second.notes.find(candidate => candidate.pitch === note.pitch)!
      return {
        pitch: note.pitch,
        ...(note.tieFromPrevious ? { tieFromPrevious: true } : {}),
        ...(continuation.tieToNext ? { tieToNext: true } : {}),
      }
    }),
  }
}

function nextSupportedDuration(remainingCells: number): number {
  const supportedDurations = [16, 12, 8, 6, 4, 3, 2, 1]
  return supportedDurations.find(duration => duration <= remainingCells) ?? 1
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum)
}
