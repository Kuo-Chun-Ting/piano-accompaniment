import type { ScoreKeySignature } from '../arrangement/types'
import type { TranscribedNote } from './types'

export type PitchSpelling = 'sharp' | 'flat'

type KeyCandidate = {
  name: ScoreKeySignature
  pitchClasses: ReadonlySet<number>
  accidentalCount: number
  spelling: PitchSpelling
}

const MINIMUM_DISTINCT_PITCH_CLASSES = 5
const KEY_CANDIDATES: KeyCandidate[] = [
  buildCandidate('C', [0, 2, 4, 5, 7, 9, 11], 0, 'sharp'),
  buildCandidate('G', [7, 9, 11, 0, 2, 4, 6], 1, 'sharp'),
  buildCandidate('D', [2, 4, 6, 7, 9, 11, 1], 2, 'sharp'),
  buildCandidate('A', [9, 11, 1, 2, 4, 6, 8], 3, 'sharp'),
  buildCandidate('E', [4, 6, 8, 9, 11, 1, 3], 4, 'sharp'),
  buildCandidate('B', [11, 1, 3, 4, 6, 8, 10], 5, 'sharp'),
  buildCandidate('F#', [6, 8, 10, 11, 1, 3, 5], 6, 'sharp'),
  buildCandidate('C#', [1, 3, 5, 6, 8, 10, 0], 7, 'sharp'),
  buildCandidate('F', [5, 7, 9, 10, 0, 2, 4], 1, 'flat'),
  buildCandidate('Bb', [10, 0, 2, 3, 5, 7, 9], 2, 'flat'),
  buildCandidate('Eb', [3, 5, 7, 8, 10, 0, 2], 3, 'flat'),
  buildCandidate('Ab', [8, 10, 0, 1, 3, 5, 7], 4, 'flat'),
  buildCandidate('Db', [1, 3, 5, 6, 8, 10, 0], 5, 'flat'),
  buildCandidate('Gb', [6, 8, 10, 11, 1, 3, 5], 6, 'flat'),
  buildCandidate('Cb', [11, 1, 3, 4, 6, 8, 10], 7, 'flat'),
]

export function inferKeySignature(notes: TranscribedNote[]): {
  name: ScoreKeySignature
  spelling: PitchSpelling
} {
  const pitchClasses = notes
    .filter(note => Number.isInteger(note.midi) && note.midi >= 0 && note.midi <= 127)
    .map(note => note.midi % 12)
  if (new Set(pitchClasses).size < MINIMUM_DISTINCT_PITCH_CLASSES) {
    return { name: 'C', spelling: 'sharp' }
  }

  const best = KEY_CANDIDATES.reduce((current, candidate) =>
    getCandidateScore(candidate, pitchClasses) < getCandidateScore(current, pitchClasses)
      ? candidate
      : current)
  return { name: best.name, spelling: best.spelling }
}

function buildCandidate(
  name: ScoreKeySignature,
  pitchClasses: number[],
  accidentalCount: number,
  spelling: PitchSpelling,
): KeyCandidate {
  return { name, pitchClasses: new Set(pitchClasses), accidentalCount, spelling }
}

function getCandidateScore(candidate: KeyCandidate, pitchClasses: number[]): number {
  const outOfKeyNotes = pitchClasses.filter(pitchClass =>
    !candidate.pitchClasses.has(pitchClass)).length
  return outOfKeyNotes * 100 + candidate.accidentalCount
}
