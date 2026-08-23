import { expect, test } from 'vitest'
import { getPlaybackGain } from '../../../shared/audio/playbackVelocity'

test('test_getPlaybackGain_when_velocity_changes_then_scales_sample_gain', () => {
  // Act
  const soft = getPlaybackGain(32)
  const loud = getPlaybackGain(96)

  // Assert
  expect(soft).toBeCloseTo(0.1764, 3)
  expect(loud).toBeCloseTo(0.5291, 3)
})

test('test_getPlaybackGain_when_velocity_is_missing_then_uses_previous_default_gain', () => {
  // Act & Assert
  expect(getPlaybackGain(undefined)).toBe(0.7)
})
