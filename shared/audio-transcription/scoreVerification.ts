import type { ScoreVersion } from '../arrangement/types'
import { buildPlaybackSchedule } from '../audio/playbackSchedule'
import type { TranscribedNote, TranscribedPedalEvent } from './types'
import {
  buildBeatOffsetConverter,
  canMergeTiedEvents,
  groupTranscribedNotesByOnset,
  midiNumberToPitch,
  SCORE_CELLS_PER_BEAT,
} from './midiToScore'

const ONSET_MATCH_TOLERANCE_SECONDS = 0.25
const DURATION_TOLERANCE_SECONDS = 0.25
const MAX_HAND_SPAN_SEMITONES = 16

export type ScorePlaybackVerificationInput = {
  version: ScoreVersion
  bpm: number
  originSeconds: number
  beatSeconds?: number[]
  notes: TranscribedNote[]
  pedalEvents: TranscribedPedalEvent[]
}

export type ScorePlaybackVerificationIssue = {
  kind: 'missing-note' | 'unexpected-note' | 'sustain-duration'
  pitch: string
  expectedSeconds?: number
  actualSeconds?: number
}

export type ScorePlaybackVerificationResult = {
  issues: ScorePlaybackVerificationIssue[]
}

export type ScoreNotationVerificationIssue =
  | {
    kind: 'measure-duration'
    staffId: 'treble' | 'bass'
    voiceId: string
    measureIndex: number
  }
  | { kind: 'invalid-tie', pitch: string, measureIndex: number }
  | {
    kind: 'redundant-tie'
    staffId: 'treble' | 'bass'
    measureIndex: number
    startBeat: number
    durationBeats: number
  }
  | { kind: 'invalid-pedal-interval' }
  | {
    kind: 'unplayable-staff-span'
    staffId: 'treble' | 'bass'
    measureIndex: number
    startBeat: number
    spanSemitones: number
  }

export type ScoreNotationVerificationResult = {
  issues: ScoreNotationVerificationIssue[]
}

export function verifyScoreNotation(version: ScoreVersion): ScoreNotationVerificationResult {
  const issues: ScoreNotationVerificationIssue[] = []

  version.measures.forEach((measure) => {
    for (const staff of measure.staves) {
      issues.push(...findUnplayableStaffSpans(staff, measure.index))
      for (const voice of staff.voices) {
        for (let eventIndex = 0; eventIndex < voice.events.length - 1; eventIndex += 1) {
          const event = voice.events[eventIndex]!
          const nextEvent = voice.events[eventIndex + 1]!
          if (canMergeTiedEvents(event, nextEvent)
            || isRedundantShortChordTie(event, nextEvent)) {
            issues.push({
              kind: 'redundant-tie',
              staffId: staff.id,
              measureIndex: measure.index,
              startBeat: event.startBeat,
              durationBeats: event.durationBeats + nextEvent.durationBeats,
            })
          }
        }

        let expectedStartBeat = 1
        for (const event of voice.events) {
          if (event.startBeat !== expectedStartBeat || event.durationBeats <= 0) {
            expectedStartBeat = Number.NaN
            break
          }
          expectedStartBeat += event.durationBeats
        }
        if (expectedStartBeat !== 5) {
          issues.push({
            kind: 'measure-duration',
            staffId: staff.id,
            voiceId: voice.id,
            measureIndex: measure.index,
          })
        }
      }
    }
  })

  for (const staffId of ['treble', 'bass'] as const) {
    const events = version.measures.flatMap((measure, measureOffset) => {
      const staff = measure.staves.find(candidate => candidate.id === staffId)
      return (staff?.voices ?? []).flatMap(voice => voice.events.map(event => ({
        event,
        measureIndex: measure.index,
        startBeatOffset: measureOffset * 4 + event.startBeat - 1,
        endBeatOffset: measureOffset * 4 + event.startBeat - 1 + event.durationBeats,
      })))
    })
    events.forEach((current) => {
      for (const note of current.event.notes.filter(candidate => candidate.tieToNext)) {
        const continuation = events.some(candidate =>
          candidate.startBeatOffset === current.endBeatOffset
          && candidate.event.notes.some(nextNote =>
            nextNote.pitch === note.pitch && nextNote.tieFromPrevious))
        if (!continuation) {
          issues.push({ kind: 'invalid-tie', pitch: note.pitch, measureIndex: current.measureIndex })
        }
      }
    })
  }

  const totalBeats = version.measures.length * 4
  if (version.pedalIntervals?.some(interval =>
    interval.startBeatOffset < 0
    || interval.endBeatOffset <= interval.startBeatOffset
    || interval.endBeatOffset > totalBeats)) {
    issues.push({ kind: 'invalid-pedal-interval' })
  }

  return { issues }
}

function isRedundantShortChordTie(
  first: ScoreVersion['measures'][number]['staves'][number]['voices'][number]['events'][number],
  second: ScoreVersion['measures'][number]['staves'][number]['voices'][number]['events'][number],
): boolean {
  const combinedDuration = first.durationBeats + second.durationBeats
  if (combinedDuration > 2
    || first.startBeat + first.durationBeats !== second.startBeat
    || first.notes.length < 2
    || first.notes.length !== second.notes.length) {
    return false
  }

  return first.notes.every((note) => {
    const continuation = second.notes.find(candidate => candidate.pitch === note.pitch)
    return note.tieToNext === true && continuation?.tieFromPrevious === true
  })
}

function findUnplayableStaffSpans(
  staff: ScoreVersion['measures'][number]['staves'][number],
  measureIndex: number,
): ScoreNotationVerificationIssue[] {
  const startBeats = [...new Set(staff.voices.flatMap(voice =>
    voice.events.map(event => event.startBeat)))].sort((left, right) => left - right)

  return startBeats.flatMap((startBeat) => {
    const pitches = staff.voices.flatMap(voice =>
      voice.events
        .filter(event => event.startBeat <= startBeat
          && startBeat < event.startBeat + event.durationBeats)
        .flatMap(event => event.notes.map(note => pitchToMidi(note.pitch))))
    if (pitches.length < 2) {
      return []
    }

    const spanSemitones = Math.max(...pitches) - Math.min(...pitches)
    return spanSemitones > MAX_HAND_SPAN_SEMITONES
      ? [{
          kind: 'unplayable-staff-span' as const,
          staffId: staff.id,
          measureIndex,
          startBeat,
          spanSemitones,
        }]
      : []
  })
}

export function verifyScorePlayback(
  input: ScorePlaybackVerificationInput,
): ScorePlaybackVerificationResult {
  const expectedNotes = buildExpectedNotes(input)
  const actualNotes = buildActualNotes(input.version, input.bpm)
  const matchedExpectedIndexes = new Set<number>()
  const issues: ScorePlaybackVerificationIssue[] = []

  for (const actual of actualNotes) {
    const matchIndex = findExpectedMatch(expectedNotes, matchedExpectedIndexes, actual)
    if (matchIndex === -1) {
      issues.push({ kind: 'unexpected-note', pitch: actual.pitch })
      continue
    }

    matchedExpectedIndexes.add(matchIndex)
    const expected = expectedNotes[matchIndex]!
    if (expected.compareDuration
      && Math.abs(expected.durationSeconds - actual.durationSeconds) > DURATION_TOLERANCE_SECONDS) {
      issues.push({
        kind: 'sustain-duration',
        pitch: actual.pitch,
        expectedSeconds: expected.durationSeconds,
        actualSeconds: actual.durationSeconds,
      })
    }
  }

  expectedNotes.forEach((expected, index) => {
    if (!matchedExpectedIndexes.has(index)) {
      issues.push({ kind: 'missing-note', pitch: expected.pitch })
    }
  })

  return { issues }
}

type ComparableNote = {
  midi: number
  pitch: string
  startSeconds: number
  durationSeconds: number
  compareDuration: boolean
}

function buildActualNotes(version: ScoreVersion, bpm: number): ComparableNote[] {
  return buildPlaybackSchedule(version, bpm).events.flatMap(event => event.pitches.map(pitch => ({
    midi: pitchToMidi(pitch),
    pitch,
    startSeconds: event.startSeconds,
    durationSeconds: event.durationSeconds,
    compareDuration: true,
  })))
}

function buildExpectedNotes(input: ScorePlaybackVerificationInput): ComparableNote[] {
  const toBeatOffset = buildBeatOffsetConverter(input.bpm, input.originSeconds, input.beatSeconds)
  const pedalIntervals = buildPedalIntervals(input.pedalEvents, toBeatOffset)
  const cellsPerBeat = SCORE_CELLS_PER_BEAT
  const secondsPerBeat = 60 / input.bpm
  const totalCells = input.version.measures.length * 4 * cellsPerBeat
  const quantizedByAttack = new Map<string, {
    midi: number
    startCell: number
    endCell: number
    compareDuration: boolean
  }>()

  const onsetGroups = groupTranscribedNotesByOnset(input.notes)
  const onsetStartCells = onsetGroups.map(group => clampInteger(
    Math.round(toBeatOffset(group[0]!.startSeconds) * cellsPerBeat),
    0,
    totalCells - 1,
  ))

  for (const [groupIndex, onsetGroup] of onsetGroups.entries()) {
    const groupStartBeatOffset = toBeatOffset(onsetGroup[0]!.startSeconds)
    const startCell = onsetStartCells[groupIndex]!
    const nextAttackCell = onsetStartCells.find((candidate, index) =>
      index > groupIndex && candidate > startCell)
    const groupEndCells = onsetGroup.map(note => clampInteger(
      Math.max(startCell + 1, Math.round(toBeatOffset(note.endSeconds) * cellsPerBeat)),
      1,
      totalCells,
    ))
    const hasStaggeredRelease = new Set(groupEndCells).size > 1
    const crossesNextAttack = nextAttackCell !== undefined
      && groupEndCells.some(endCell => endCell > nextAttackCell)
    const compareDuration = !hasStaggeredRelease
      && !crossesNextAttack
      && !isPedaledChord(onsetGroup, pedalIntervals, toBeatOffset)

    for (const [noteIndex, note] of onsetGroup.entries()) {
      if (note.endSeconds <= input.originSeconds
        || groupStartBeatOffset >= totalCells / cellsPerBeat) {
        continue
      }
      const endCell = groupEndCells[noteIndex]!
      const key = `${note.midi}:${startCell}`
      const existing = quantizedByAttack.get(key)
      if (!existing || existing.endCell < endCell) {
        quantizedByAttack.set(key, { midi: note.midi, startCell, endCell, compareDuration })
      }
    }
  }

  const notesByMidi = new Map<number, Array<{ midi: number, startCell: number, endCell: number }>>()
  for (const note of quantizedByAttack.values()) {
    notesByMidi.set(note.midi, [...(notesByMidi.get(note.midi) ?? []), note])
  }
  for (const notes of notesByMidi.values()) {
    notes.sort((left, right) => left.startCell - right.startCell)
    notes.forEach((note, index) => {
      const nextAttack = notes[index + 1]?.startCell
      if (nextAttack !== undefined && note.endCell > nextAttack) {
        note.endCell = nextAttack
      }
    })
  }

  return [...quantizedByAttack.values()]
    .filter(note => note.endCell > note.startCell)
    .map((note) => {
      const startBeatOffset = note.startCell / cellsPerBeat
      const endBeatOffset = note.endCell / cellsPerBeat
      const audibleEndBeatOffset = findAudibleEndBeatOffset(endBeatOffset, pedalIntervals)
      return {
        midi: note.midi,
        pitch: midiNumberToPitch(note.midi),
        startSeconds: startBeatOffset * secondsPerBeat,
        durationSeconds: (audibleEndBeatOffset - startBeatOffset) * secondsPerBeat,
        compareDuration: note.compareDuration,
      }
    })
}

function isPedaledChord(
  notes: TranscribedNote[],
  pedalIntervals: PedalIntervalBeats[],
  toBeatOffset: (seconds: number) => number,
): boolean {
  if (notes.length < 3) {
    return false
  }

  const startBeatOffset = toBeatOffset(notes[0]!.startSeconds)
  const endBeatOffset = Math.max(...notes.map(note => toBeatOffset(note.endSeconds)))
  return pedalIntervals.some(interval =>
    interval.startBeatOffset < endBeatOffset && interval.endBeatOffset > startBeatOffset)
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum)
}

function findExpectedMatch(
  expectedNotes: ComparableNote[],
  matchedIndexes: Set<number>,
  actual: ComparableNote,
): number {
  let bestIndex = -1
  let bestDifference = Number.POSITIVE_INFINITY

  expectedNotes.forEach((expected, index) => {
    const difference = Math.abs(expected.startSeconds - actual.startSeconds)
    if (!matchedIndexes.has(index)
      && expected.midi === actual.midi
      && difference <= ONSET_MATCH_TOLERANCE_SECONDS
      && difference < bestDifference) {
      bestIndex = index
      bestDifference = difference
    }
  })

  return bestIndex
}

type PedalIntervalBeats = {
  startBeatOffset: number
  endBeatOffset: number
}

function buildPedalIntervals(
  events: TranscribedPedalEvent[],
  toBeatOffset: (seconds: number) => number,
): PedalIntervalBeats[] {
  const intervals: PedalIntervalBeats[] = []
  let startSeconds: number | null = null

  for (const event of [...events].sort((left, right) => left.timeSeconds - right.timeSeconds)) {
    if (event.value >= 64) {
      startSeconds ??= event.timeSeconds
    } else if (startSeconds !== null) {
      intervals.push({
        startBeatOffset: toBeatOffset(startSeconds),
        endBeatOffset: toBeatOffset(event.timeSeconds),
      })
      startSeconds = null
    }
  }

  return intervals
}

function findAudibleEndBeatOffset(
  noteEndBeatOffset: number,
  intervals: PedalIntervalBeats[],
): number {
  const pedal = intervals.find(interval =>
    interval.startBeatOffset <= noteEndBeatOffset && noteEndBeatOffset < interval.endBeatOffset)
  return pedal?.endBeatOffset ?? noteEndBeatOffset
}

function pitchToMidi(pitch: string): number {
  const match = pitch.match(/^([A-G])([#b]?)(\d)$/)
  if (!match) {
    return Number.NaN
  }

  const semitones = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  } as const
  const semitone = semitones[match[1] as keyof typeof semitones]
  const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0
  return (Number(match[3]) + 1) * 12 + semitone + accidental
}
