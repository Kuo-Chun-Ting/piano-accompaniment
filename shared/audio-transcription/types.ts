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

export type TranscriptionInput = {
  notes: TranscribedNote[]
  pedalEvents?: TranscribedPedalEvent[]
  bpm: number
  durationSeconds: number
  firstDownbeatSeconds?: number
  measureCount?: number
}
