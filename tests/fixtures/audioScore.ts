import type { ViewerScoreData } from '../../tools/audio-score-viewer/viewerData'

export function buildAudioScoreFixture(): ViewerScoreData {
  return {
    title: 'Audio Fixture', tempo: 120,
    version: {
      level: 'rich',
      measures: Array.from({ length: 12 }, (_, index) => ({
        index: index + 1, sectionId: 'a', sectionLabel: 'A', chordSymbols: [], lyrics: [], intensity: 'soft',
        staves: (['treble', 'bass'] as const).map(id => ({
          id, clef: id, voices: [{ id: '1', events: [{ startBeat: 1, durationBeats: 4, notes: [{ pitch: id === 'treble' ? 'C4' : 'C3' }] }] }],
        })),
      })),
    },
    referenceAudio: { src: 'piano.wav', sourceBpm: 120, scoreStartSeconds: 2, beatSeconds: Array.from({ length: 49 }, (_, i) => 2 + i * .5) },
  }
}

/** Audible PCM fixture; native HTMLAudioElement decodes and seeks it. */
export function buildAudioWavFixture(seconds = 28): Buffer {
  const sampleRate = 8000
  const bytes = sampleRate * seconds * 2
  const wav = Buffer.alloc(44 + bytes)
  wav.write('RIFF', 0); wav.writeUInt32LE(bytes + 36, 4); wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28)
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(bytes, 40)
  for (let i = 0; i < bytes / 2; i++) wav.writeInt16LE(Math.round(1800 * Math.sin(2 * Math.PI * 262 * i / sampleRate)), 44 + i * 2)
  return wav
}
