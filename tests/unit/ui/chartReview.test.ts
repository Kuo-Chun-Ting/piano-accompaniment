import { describe, expect, test } from 'vitest'
import {
  buildPlacementGridTemplate,
  getMeasureBeatState,
} from '../../../shared/ui/chartReview'

describe('chart review UI helpers', () => {
  test('test_buildPlacementGridTemplate_when_chords_have_different_durations_then_returns_beat_proportional_columns', () => {
    // Arrange
    const placements = [{ durationBeats: 1 }, { durationBeats: 2 }, { durationBeats: 1 }]

    // Act
    const result = buildPlacementGridTemplate(placements)

    // Assert
    expect(result).toBe('1fr 2fr 1fr')
  })

  test('test_buildPlacementGridTemplate_when_duration_is_missing_then_keeps_column_visible', () => {
    // Arrange
    const placements = [{ durationBeats: 0 }, { durationBeats: 4 }]

    // Act
    const result = buildPlacementGridTemplate(placements)

    // Assert
    expect(result).toBe('0.5fr 4fr')
  })

  test('test_getMeasureBeatState_when_measure_has_five_beats_then_returns_overflow', () => {
    // Arrange
    const placements = [{ durationBeats: 4 }, { durationBeats: 1 }]

    // Act
    const result = getMeasureBeatState(placements)

    // Assert
    expect(result).toEqual({ total: 5, status: 'overflow' })
  })

  test('test_getMeasureBeatState_when_measure_has_three_beats_then_returns_incomplete', () => {
    // Arrange
    const placements = [{ durationBeats: 2 }, { durationBeats: 1 }]

    // Act
    const result = getMeasureBeatState(placements)

    // Assert
    expect(result).toEqual({ total: 3, status: 'incomplete' })
  })
})
