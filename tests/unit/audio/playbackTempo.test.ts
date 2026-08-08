import { describe, expect, test } from 'vitest'
import {
  normalizePlaybackBpm,
  resolveInitialPlaybackBpm,
} from '../../../shared/audio/playbackTempo'

describe('playbackTempo', () => {
  test('test_resolveInitialPlaybackBpm_when_source_exists_then_returns_source_bpm', () => {
    // Arrange
    const sourceBpm = 73

    // Act
    const result = resolveInitialPlaybackBpm(sourceBpm)

    // Assert
    expect(result).toBe(73)
  })

  test('test_resolveInitialPlaybackBpm_when_source_is_missing_then_returns_default_bpm', () => {
    // Arrange
    const sourceBpm = null

    // Act
    const result = resolveInitialPlaybackBpm(sourceBpm)

    // Assert
    expect(result).toBe(72)
  })

  test('test_normalizePlaybackBpm_when_value_is_outside_range_then_clamps_value', () => {
    // Act & Assert
    expect(normalizePlaybackBpm(20, 73)).toBe(40)
    expect(normalizePlaybackBpm(240, 73)).toBe(200)
  })

  test('test_normalizePlaybackBpm_when_value_is_invalid_then_returns_fallback', () => {
    // Act & Assert
    expect(normalizePlaybackBpm(Number.NaN, 73)).toBe(73)
  })
})
