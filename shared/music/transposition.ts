import type { ConfirmedChart, ConfirmedChordPlacement } from '../schemas/chart'
import { normalizeChordSymbol, spellTransposedNote } from './chords'

const NOTE_TO_SEMITONE: Record<string, number> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
}

const NOTE_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

type TranspositionInterval = {
  semitoneSteps: number
  letterSteps: number
}

export function transposeConfirmedChart(chart: ConfirmedChart): ConfirmedChart {
  const interval = getTranspositionInterval(chart.originalKey, chart.normalizedKey)

  return {
    ...chart,
    originalKey: chart.originalKey,
    sections: chart.sections.map((section) => ({
      ...section,
      measures: section.measures.map((measure) => ({
        ...measure,
        chords: measure.chords.map((placement) => transposePlacement(placement, interval)),
      })),
    })),
  }
}

function getTranspositionInterval(originalKey: string, normalizedKey: 'C' | 'Am'): TranspositionInterval {
  const originalRoot = originalKey.match(/^[A-G](?:#|b)?/)?.[0]
  const targetRoot = normalizedKey === 'C' ? 'C' : 'A'

  if (!originalRoot || NOTE_TO_SEMITONE[originalRoot] === undefined) {
    throw new Error(`Unsupported original key: ${originalKey}`)
  }

  return {
    semitoneSteps: (NOTE_TO_SEMITONE[targetRoot] - NOTE_TO_SEMITONE[originalRoot] + 12) % 12,
    letterSteps: (NOTE_LETTERS.indexOf(targetRoot) - NOTE_LETTERS.indexOf(originalRoot[0]) + 7) % 7,
  }
}

function transposePlacement(placement: ConfirmedChordPlacement, interval: TranspositionInterval): ConfirmedChordPlacement {
  return { ...placement, chord: transposeChordSymbol(placement.chord, interval) }
}

function transposeChordSymbol(symbol: string, interval: TranspositionInterval): string {
  const normalizedSymbol = normalizeChordSymbol(symbol)
  const match = normalizedSymbol?.match(/^([A-G](?:#|b)?)([^/]*)(?:\/([A-G](?:#|b)?))?$/)

  if (!match) {
    throw new Error(`Unsupported chord: ${symbol}`)
  }

  const [, root, quality, bass] = match
  const transposedRoot = transposeNote(root, interval)
  const transposedBass = bass ? `/${transposeNote(bass, interval)}` : ''
  return `${transposedRoot}${quality}${transposedBass}`
}

function transposeNote(note: string, interval: TranspositionInterval): string {
  return spellTransposedNote(note, interval.semitoneSteps, interval.letterSteps)
}
