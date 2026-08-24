import type { Mood } from '../schemas/chart'

export type ArrangementLevelName = 'easy' | 'rich'
export type MeasureIntensity = 'soft' | 'medium' | 'strong'
export type ScoreKeySignature =
  | 'C' | 'G' | 'D' | 'A' | 'E' | 'B' | 'F#' | 'C#'
  | 'F' | 'Bb' | 'Eb' | 'Ab' | 'Db' | 'Gb' | 'Cb'

export type ScoreEvent = {
  startBeat: number
  durationBeats: number
  notes: ScoreNote[]
  chordSymbol?: string
}

export type ScoreNote = {
  pitch: string
  finger?: number
  tieFromPrevious?: boolean
  tieToNext?: boolean
}

export type ScoreVoice = {
  id: string
  events: ScoreEvent[]
}

export type ScoreStaff = {
  id: 'treble' | 'bass'
  clef: 'treble' | 'bass'
  voices: ScoreVoice[]
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
  staves: ScoreStaff[]
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
