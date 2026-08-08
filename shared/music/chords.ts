export type ChordQuality =
  | 'major'
  | 'minor'
  | 'dominant7'
  | 'dominant7Flat9'
  | 'dominant9'
  | 'dominant13'
  | 'dominant7sus4'
  | 'major7'
  | 'minor7'
  | 'minor7Flat5'
  | 'sus2'
  | 'sus4'
  | 'add2'
  | 'add9'
  | 'diminished'

export type ParsedChord = {
  symbol: string
  root: string
  bass: string | null
  quality: ChordQuality
}

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

const SHARP_NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const NOTE_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

const QUALITY_INTERVALS: Record<ChordQuality, number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  dominant7: [0, 4, 7, 10],
  dominant7Flat9: [0, 4, 7, 10, 1],
  dominant9: [0, 4, 7, 10, 2],
  dominant13: [0, 4, 7, 10, 2, 9],
  dominant7sus4: [0, 5, 7, 10],
  major7: [0, 4, 7, 11],
  minor7: [0, 3, 7, 10],
  minor7Flat5: [0, 3, 6, 10],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  add2: [0, 4, 7, 2],
  add9: [0, 4, 7, 2],
  diminished: [0, 3, 6],
}

const QUALITY_LETTER_STEPS: Record<ChordQuality, number[]> = {
  major: [0, 2, 4],
  minor: [0, 2, 4],
  dominant7: [0, 2, 4, 6],
  dominant7Flat9: [0, 2, 4, 6, 1],
  dominant9: [0, 2, 4, 6, 1],
  dominant13: [0, 2, 4, 6, 1, 5],
  dominant7sus4: [0, 3, 4, 6],
  major7: [0, 2, 4, 6],
  minor7: [0, 2, 4, 6],
  minor7Flat5: [0, 2, 4, 6],
  sus2: [0, 1, 4],
  sus4: [0, 3, 4],
  add2: [0, 2, 4, 1],
  add9: [0, 2, 4, 1],
  diminished: [0, 2, 4],
}

export function parseChordSymbol(symbol: string): ParsedChord | null {
  const normalizedSymbol = normalizeChordSymbol(symbol)
  const match = normalizedSymbol?.match(/^([A-G](?:#|b)?)(maj7|m7-5|m7|7sus4|7-9|m|13|9|7|sus2|sus4|add2|add9|dim)?(?:\/([A-G](?:#|b)?))?$/)

  if (!match) {
    return null
  }

  const [, rootToken, qualityToken, bassToken] = match
  const root = normalizeNoteName(rootToken) ? rootToken : null
  const bass = bassToken && normalizeNoteName(bassToken) ? bassToken : null

  if (!root || (bassToken && !bass)) {
    return null
  }

  return {
    symbol: match[0],
    root,
    bass,
    quality: parseQuality(qualityToken),
  }
}

export function getChordToneNames(parsedChord: ParsedChord): string[] {
  return QUALITY_INTERVALS[parsedChord.quality].map((interval, index) =>
    spellTransposedNote(parsedChord.root, interval, QUALITY_LETTER_STEPS[parsedChord.quality][index]),
  )
}

export function normalizeChordSymbol(symbol: string): string | null {
  const normalizedAccidentals = symbol
    .trim()
    .replaceAll('♭', 'b')
    .replaceAll('♯', '#')
    .replaceAll('／', '/')
    .replace(/\s+/g, '')

  if (!normalizedAccidentals) {
    return null
  }

  return normalizeOptionalChordParentheses(normalizedAccidentals)
}

export function spellTransposedNote(note: string, semitoneSteps: number, letterSteps: number): string {
  const sourceSemitone = NOTE_TO_SEMITONE[note]
  const sourceLetterIndex = NOTE_LETTERS.indexOf(note[0])

  if (sourceSemitone === undefined || sourceLetterIndex < 0) {
    throw new Error(`Unsupported note: ${note}`)
  }

  const targetSemitone = (sourceSemitone + semitoneSteps) % 12
  const targetLetter = NOTE_LETTERS[(sourceLetterIndex + letterSteps) % NOTE_LETTERS.length]
  const accidentalDistance = (targetSemitone - NOTE_TO_SEMITONE[targetLetter] + 12) % 12

  if (accidentalDistance === 0) {
    return targetLetter
  }

  if (accidentalDistance === 1) {
    return `${targetLetter}#`
  }

  if (accidentalDistance === 11) {
    return `${targetLetter}b`
  }

  return SHARP_NOTE_NAMES[targetSemitone]
}

export function normalizeNoteName(note: string): string | null {
  const semitone = NOTE_TO_SEMITONE[note]

  if (semitone === undefined) {
    return null
  }

  return SHARP_NOTE_NAMES[semitone]
}

function parseQuality(token: string | undefined): ChordQuality {
  if (!token) {
    return 'major'
  }

  const qualityByToken: Record<string, ChordQuality> = {
    m: 'minor',
    '7': 'dominant7',
    '7-9': 'dominant7Flat9',
    '9': 'dominant9',
    '13': 'dominant13',
    '7sus4': 'dominant7sus4',
    maj7: 'major7',
    m7: 'minor7',
    'm7-5': 'minor7Flat5',
    sus2: 'sus2',
    sus4: 'sus4',
    add2: 'add2',
    add9: 'add9',
    dim: 'diminished',
  }

  return qualityByToken[token]
}

function normalizeOptionalChordParentheses(symbol: string): string {
  const [chordToken, bassToken] = symbol.split('/')
  const normalizedChordToken = chordToken.match(/^\(([^()]+)\)$/)?.[1] ?? chordToken
  return bassToken ? `${normalizedChordToken}/${bassToken}` : normalizedChordToken
}
