export type TranscribedNote = {
  midi: number
  startSeconds: number
  endSeconds: number
  velocity: number
}

export type TranscribedPedalEvent = {
  timeSeconds: number
  value: number
}

export type TranscribedLyricSegment = {
  startSeconds: number
  endSeconds: number
  text: string
}

export type TranscriptionInput = {
  notes: TranscribedNote[]
  pedalEvents?: TranscribedPedalEvent[]
  lyricSegments?: TranscribedLyricSegment[]
  bpm: number
  durationSeconds: number
  firstDownbeatSeconds?: number
  beatSeconds?: number[]
  downbeatSeconds?: number[]
  measureCount?: number
}
