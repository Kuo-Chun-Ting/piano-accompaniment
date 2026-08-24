import { expect, test } from 'vitest'
import {
  getReferenceAudioBeatOffset,
  getReferenceAudioPlaybackRate,
  getReferenceAudioSeconds,
} from '../../../shared/audio/referenceAudio'

test('test_getReferenceAudioSeconds_when_seeking_score_beat_then_uses_detected_beat_timeline', () => {
  // Arrange
  const referenceAudio = {
    src: 'piano.wav',
    scoreStartSeconds: 8.79,
    sourceBpm: 71,
    beatSeconds: [8.79, 9.61, 10.48, 11.29],
  }

  // Act
  const audioSeconds = getReferenceAudioSeconds(referenceAudio, 1.5)

  // Assert
  expect(audioSeconds).toBeCloseTo(10.045)
})

test('test_getReferenceAudioBeatOffset_when_audio_is_playing_then_returns_shared_score_position', () => {
  // Arrange
  const referenceAudio = {
    src: 'piano.wav',
    scoreStartSeconds: 8.79,
    sourceBpm: 71,
    beatSeconds: [8.79, 9.61, 10.48, 11.29],
  }

  // Act
  const beatOffset = getReferenceAudioBeatOffset(referenceAudio, 10.045)

  // Assert
  expect(beatOffset).toBeCloseTo(1.5)
})

test('test_getReferenceAudioPlaybackRate_when_tempo_changes_then_scales_from_source_bpm', () => {
  // Arrange
  const sourceBpm = 80
  const playbackBpm = 100

  // Act
  const playbackRate = getReferenceAudioPlaybackRate(sourceBpm, playbackBpm)

  // Assert
  expect(playbackRate).toBe(1.25)
})
