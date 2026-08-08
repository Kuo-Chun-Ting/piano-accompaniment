import { expect, test } from 'vitest'
import { normalizeSamplePitch, PIANO_SAMPLE_URLS } from '../../../shared/audio/pianoSamples'

test('test_normalizeSamplePitch_when_pitch_uses_flat_then_returns_matching_sharp_sample', () => {
  // Act & Assert
  expect(normalizeSamplePitch('Db3')).toBe('C#3')
  expect(normalizeSamplePitch('Eb4')).toBe('D#4')
  expect(normalizeSamplePitch('Gb4')).toBe('F#4')
  expect(normalizeSamplePitch('Ab4')).toBe('G#4')
  expect(normalizeSamplePitch('Bb3')).toBe('A#3')
})

test('test_PIANO_SAMPLE_URLS_when_catalog_is_built_then_contains_each_supported_key', () => {
  // Act
  const samplePitches = Object.keys(PIANO_SAMPLE_URLS)

  // Assert
  expect(samplePitches).toHaveLength(85)
  expect(PIANO_SAMPLE_URLS.C1).toContain('/C1.mp3')
  expect(PIANO_SAMPLE_URLS['A#4']).toContain('/As4.mp3')
  expect(PIANO_SAMPLE_URLS.C8).toContain('/C8.mp3')
})
