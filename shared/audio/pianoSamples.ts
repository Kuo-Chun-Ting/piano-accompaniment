const SAMPLE_BASE_URL = 'https://cdn.jsdelivr.net/npm/tonejs-instrument-piano-mp3@1.1.2/'
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

const FLAT_TO_SHARP: Readonly<Record<string, string>> = {
  Db: 'C#',
  Eb: 'D#',
  Gb: 'F#',
  Ab: 'G#',
  Bb: 'A#',
}

export const PIANO_SAMPLE_URLS: Readonly<Record<string, string>> = Object.freeze(buildSampleUrls())

export function normalizeSamplePitch(pitch: string): string {
  const match = pitch.match(/^([A-G](?:#|b)?)(\d+)$/)

  if (!match) {
    return pitch
  }

  const [, noteName, octave] = match
  return `${FLAT_TO_SHARP[noteName] ?? noteName}${octave}`
}

function buildSampleUrls(): Record<string, string> {
  const urls: Record<string, string> = {}

  for (let octave = 1; octave <= 7; octave += 1) {
    NOTE_NAMES.forEach((noteName) => addSampleUrl(urls, noteName, octave))
  }

  addSampleUrl(urls, 'C', 8)
  return urls
}

function addSampleUrl(urls: Record<string, string>, noteName: string, octave: number): void {
  const pitch = `${noteName}${octave}`
  const filename = `${noteName.replace('#', 's')}${octave}.mp3`
  urls[pitch] = `${SAMPLE_BASE_URL}${filename}`
}
