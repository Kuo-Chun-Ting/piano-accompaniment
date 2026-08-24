import { effectScope, ref } from 'vue'
import { afterEach, expect, test, vi } from 'vitest'
import { usePianoPlayback } from '../../../composables/usePianoPlayback'
import type { ScoreVersion } from '../../../shared/arrangement/types'

let audio: FakeAudio | null = null

afterEach(() => {
  vi.unstubAllGlobals()
  audio = null
})

test('test_usePianoPlayback_when_reference_mode_plays_seeks_and_changes_tempo_then_keeps_shared_timeline', async () => {
  // Arrange
  installBrowserAudioStub()
  const referenceAudio = ref({
    src: 'piano.wav',
    scoreStartSeconds: 8.79,
    sourceBpm: 120,
    beatSeconds: [8.79, 9.61, 10.48, 11.29],
  })
  const scope = effectScope()
  const playback = scope.run(() => usePianoPlayback(referenceAudio))!
  const version = buildVersion()

  // Act
  await playback.setPlaybackMode('reference', version, 120)
  await playback.togglePlayback(version, 120)
  await playback.seekPlayback(version, 120, 1)
  await playback.changePlaybackTempo(version, 96)

  // Assert
  expect(playback.mode.value).toBe('reference')
  expect(audio?.src).toContain('piano.wav')
  expect(audio?.currentTime).toBeCloseTo(10.48)
  expect(audio?.playbackRate).toBe(0.8)
  expect(audio?.preservesPitch).toBe(true)
  scope.stop()
})

function installBrowserAudioStub(): void {
  class AudioStub extends FakeAudio {
    constructor(src: string) {
      super(src)
      audio = this
    }
  }
  vi.stubGlobal('Audio', AudioStub)
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
}

class FakeAudio {
  currentTime = 0
  playbackRate = 1
  preservesPitch = false
  preload = ''
  paused = true

  constructor(public src: string) {}

  async play(): Promise<void> {
    this.paused = false
  }

  pause(): void {
    this.paused = true
  }

  addEventListener(): void {}
  removeEventListener(): void {}
}

function buildVersion(): ScoreVersion {
  return {
    level: 'rich',
    measures: [{
      sectionId: 'test',
      sectionLabel: 'Test',
      index: 1,
      chordSymbols: [],
      lyrics: [],
      intensity: 'medium',
      staves: [
        {
          id: 'treble',
          clef: 'treble',
          voices: [{ id: 'treble-1', events: [{ startBeat: 1, durationBeats: 4, notes: [] }] }],
        },
        {
          id: 'bass',
          clef: 'bass',
          voices: [{ id: 'bass-1', events: [{ startBeat: 1, durationBeats: 4, notes: [] }] }],
        },
      ],
    }],
  }
}
