import { getChordToneNames, type ParsedChord } from '../music/chords'
import type { Mood } from '../schemas/chart'
import type { ArrangementLevelName, ScoreEvent } from './types'

export type PatternInput = {
  chord: ParsedChord
  durationBeats: number
  startBeat: number
  mood: Mood
  level: ArrangementLevelName
  strongSection: boolean
}

export type HandPattern = {
  leftHand: ScoreEvent[]
  rightHand: ScoreEvent[]
}

const NOTE_TO_SEMITONE: Record<string, number> = {
  C: 0,
  'C#': 1,
  D: 2,
  'D#': 3,
  E: 4,
  F: 5,
  'F#': 6,
  G: 7,
  'G#': 8,
  A: 9,
  'A#': 10,
  B: 11,
}

export function buildHandPattern(input: PatternInput): HandPattern {
  if (input.level === 'easy') {
    return buildEasyPattern(input)
  }

  if (input.mood === 'spacious-ballad') {
    return buildSpaciousRichPattern(input)
  }

  if (input.mood === 'flowing-narrative') {
    return buildFlowingRichPattern(input)
  }

  return buildUrbanRichPattern(input)
}

function buildEasyPattern(input: PatternInput): HandPattern {
  const voicing = buildRightHandVoicing(input.chord, false, input.strongSection)
  const root = buildLeftPitch(input.chord.bass || input.chord.root, 2)
  const units = splitDuration(input.durationBeats, 2)

  return {
    leftHand: buildEvents(input.startBeat, units, () => [root], [5]),
    rightHand: buildEvents(input.startBeat, units, () => voicing, [1, 3, 5]),
  }
}

function buildSpaciousRichPattern(input: PatternInput): HandPattern {
  const tones = getChordToneNames(input.chord)
  const voicing = buildRightHandVoicing(input.chord, true, input.strongSection)
  const root = buildLeftPitch(input.chord.bass || input.chord.root, 2)
  const fifth = buildLeftPitch(tones[2] || input.chord.root, 2)
  const units = splitDuration(input.durationBeats, 1)

  return {
    leftHand: buildEvents(input.startBeat, units, (index) => [index % 2 === 0 ? root : fifth], [5]),
    rightHand: buildEvents(input.startBeat, units, (index) => index % 2 === 0 ? voicing : [], [1, 2, 4, 5]),
  }
}

function buildFlowingRichPattern(input: PatternInput): HandPattern {
  const tones = getChordToneNames(input.chord)
  const voicing = buildRightHandVoicing(input.chord, false, input.strongSection)
  const bassCycle = [input.chord.bass || input.chord.root, tones[2], input.chord.root, tones[2]]
    .map((note, index) => buildLeftPitch(note || input.chord.root, index === 2 ? 3 : 2))
  const units = splitDuration(input.durationBeats, 0.5)

  return {
    leftHand: buildEvents(input.startBeat, units, (index) => [bassCycle[index % bassCycle.length]], [5, 2, 1, 2]),
    rightHand: buildEvents(input.startBeat, units, (index) => [voicing[index % voicing.length]], [1, 2, 3, 5]),
  }
}

function buildUrbanRichPattern(input: PatternInput): HandPattern {
  const tones = getChordToneNames(input.chord)
  const voicing = buildRightHandVoicing(input.chord, true, input.strongSection)
  const root = buildLeftPitch(input.chord.bass || input.chord.root, 2)
  const octave = buildLeftPitch(input.chord.bass || input.chord.root, 3)
  const fifth = buildLeftPitch(tones[2] || input.chord.root, 2)
  const units = splitDuration(input.durationBeats, 0.5)
  const bassPattern = [[root], [], [octave], [fifth]]
  const chordPattern = [[], voicing, [], voicing.slice(0, input.strongSection ? 4 : 3)]

  return {
    leftHand: buildEvents(input.startBeat, units, (index) => bassPattern[index % bassPattern.length], [5, 1, 2]),
    rightHand: buildEvents(input.startBeat, units, (index) => chordPattern[index % chordPattern.length], [1, 2, 4, 5]),
  }
}

function splitDuration(durationBeats: number, maximumUnit: number): number[] {
  const units: number[] = []
  let remaining = durationBeats

  while (remaining > 0) {
    const unit = [2, 1, 0.5].find((candidate) => candidate <= maximumUnit && candidate <= remaining)

    if (!unit) {
      throw new Error(`Unsupported rhythmic duration: ${durationBeats}`)
    }

    units.push(unit)
    remaining -= unit
  }

  return units
}

function buildEvents(
  startBeat: number,
  durations: number[],
  buildPitches: (index: number) => string[],
  fingers: number[],
): ScoreEvent[] {
  let cursor = startBeat

  return durations.map((durationBeats, index) => {
    const pitches = buildPitches(index)
    const event = {
      startBeat: cursor,
      durationBeats,
      pitches,
      fingers: pitches.map((_, pitchIndex) => fingers[pitchIndex] || fingers.at(-1) || 1),
      tieToNext: false,
    }
    cursor += durationBeats
    return event
  })
}

function buildRightHandVoicing(chord: ParsedChord, includeColor: boolean, strongSection: boolean): string[] {
  const toneNames = getChordToneNames(chord).slice(0, includeColor ? 4 : 3)
  const candidates = toneNames.map((name) => buildPitchNearMiddleC(name))
  const sorted = candidates.sort((left, right) => pitchToMidi(left) - pitchToMidi(right))
  const shifted = strongSection ? sorted.map(raisePitchIfPossible) : sorted
  return shifted
}

function buildPitchNearMiddleC(note: string): string {
  const semitone = NOTE_TO_SEMITONE[note]
  const octave = semitone < 5 ? 4 : 3
  return `${note}${octave}`
}

function buildLeftPitch(note: string, octave: number): string {
  return `${note}${octave}`
}

function raisePitchIfPossible(pitch: string): string {
  const match = pitch.match(/^(.+?)(\d)$/)
  return match ? `${match[1]}${Number(match[2]) + 1}` : pitch
}

function pitchToMidi(pitch: string): number {
  const match = pitch.match(/^(.+?)(\d)$/)

  if (!match) {
    return 0
  }

  return (Number(match[2]) + 1) * 12 + NOTE_TO_SEMITONE[match[1]]
}
