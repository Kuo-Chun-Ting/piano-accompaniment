import type { ScoreVersion } from '../arrangement/types'
import { buildPlaybackSchedule } from '../audio/playbackSchedule'
import type { TranscribedNote, TranscribedPedalEvent } from './types'
import { midiNumberToPitch } from './midiToScore'

const ONSET_MATCH_TOLERANCE_SECONDS = 0.25
const DURATION_TOLERANCE_SECONDS = 0.25

export type ScorePlaybackVerificationInput = {
  version: ScoreVersion
  bpm: number
  originSeconds: number
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
  | { kind: 'measure-duration', hand: 'right' | 'left', measureIndex: number }
  | { kind: 'invalid-tie', pitch: string, measureIndex: number }
  | { kind: 'invalid-pedal-interval' }

export type ScoreNotationVerificationResult = {
  issues: ScoreNotationVerificationIssue[]
}

export function verifyScoreNotation(version: ScoreVersion): ScoreNotationVerificationResult {
  const issues: ScoreNotationVerificationIssue[] = []

  version.measures.forEach((measure) => {
    for (const [hand, events] of [
      ['right', measure.rightHand],
      ['left', measure.leftHand],
    ] as const) {
      let expectedStartBeat = 1
      for (const event of events) {
        if (event.startBeat !== expectedStartBeat || event.durationBeats <= 0) {
          expectedStartBeat = Number.NaN
          break
        }
        expectedStartBeat += event.durationBeats
      }
      if (expectedStartBeat !== 5) {
        issues.push({ kind: 'measure-duration', hand, measureIndex: measure.index })
      }
    }
  })

  for (const hand of ['rightHand', 'leftHand'] as const) {
    const events = version.measures.flatMap(measure =>
      measure[hand].map(event => ({ event, measureIndex: measure.index })))
    events.forEach(({ event, measureIndex }, index) => {
      for (const pitch of event.tieToNextPitches ?? []) {
        const nextEvent = events[index + 1]?.event
        if (!event.pitches.includes(pitch)
          || !nextEvent?.pitches.includes(pitch)
          || !nextEvent.tieFromPreviousPitches?.includes(pitch)) {
          issues.push({ kind: 'invalid-tie', pitch, measureIndex })
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
    if (Math.abs(expected.durationSeconds - actual.durationSeconds) > DURATION_TOLERANCE_SECONDS) {
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
}

function buildActualNotes(version: ScoreVersion, bpm: number): ComparableNote[] {
  return buildPlaybackSchedule(version, bpm).events.flatMap(event => event.pitches.map(pitch => ({
    midi: pitchToMidi(pitch),
    pitch,
    startSeconds: event.startSeconds,
    durationSeconds: event.durationSeconds,
  })))
}

function buildExpectedNotes(input: ScorePlaybackVerificationInput): ComparableNote[] {
  const pedalIntervals = buildPedalIntervals(input.pedalEvents)

  return input.notes
    .filter(note => note.endSeconds > input.originSeconds)
    .map((note) => {
      const startSeconds = Math.max(note.startSeconds - input.originSeconds, 0)
      const audibleEndSeconds = findAudibleEndSeconds(note.endSeconds, pedalIntervals)
      return {
        midi: note.midi,
        pitch: midiNumberToPitch(note.midi),
        startSeconds,
        durationSeconds: audibleEndSeconds - input.originSeconds - startSeconds,
      }
    })
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

type PedalIntervalSeconds = {
  startSeconds: number
  endSeconds: number
}

function buildPedalIntervals(events: TranscribedPedalEvent[]): PedalIntervalSeconds[] {
  const intervals: PedalIntervalSeconds[] = []
  let startSeconds: number | null = null

  for (const event of [...events].sort((left, right) => left.timeSeconds - right.timeSeconds)) {
    if (event.value >= 64) {
      startSeconds ??= event.timeSeconds
    } else if (startSeconds !== null) {
      intervals.push({ startSeconds, endSeconds: event.timeSeconds })
      startSeconds = null
    }
  }

  return intervals
}

function findAudibleEndSeconds(noteEndSeconds: number, intervals: PedalIntervalSeconds[]): number {
  const pedal = intervals.find(interval =>
    interval.startSeconds <= noteEndSeconds && noteEndSeconds < interval.endSeconds)
  return pedal?.endSeconds ?? noteEndSeconds
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
