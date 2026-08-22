import type { Mood } from '../schemas/chart'

export type ArrangementLevelName = 'easy' | 'rich'
export type MeasureIntensity = 'soft' | 'medium' | 'strong'
export type ScoreKeySignature =
  | 'C' | 'G' | 'D' | 'A' | 'E' | 'B' | 'F#' | 'C#'
  | 'F' | 'Bb' | 'Eb' | 'Ab' | 'Db' | 'Gb' | 'Cb'

export type ScoreEvent = {
  startBeat: number
  durationBeats: number
  pitches: string[]
  fingers: number[]
  tieToNext: boolean
  tieFromPrevious?: boolean
  chordSymbol?: string
}

export type ScoreLyricCue = {
  startBeat: number
  text: string
}

export type ScoreMeasure = {
  sectionId: string
  sectionLabel: string
  index: number
  chordSymbols: string[]
  lyrics: ScoreLyricCue[]
  intensity: MeasureIntensity
  rightHand: ScoreEvent[]
  leftHand: ScoreEvent[]
}

export type ScorePedalInterval = {
  startBeatOffset: number
  endBeatOffset: number
}

export type ScoreVersion = {
  level: ArrangementLevelName
  measures: ScoreMeasure[]
  keySignature?: ScoreKeySignature
  pedalIntervals?: ScorePedalInterval[]
}

export type ArrangementSet = {
  mood: Mood
  versions: ScoreVersion[]
  blockingIssues: string[]
}
