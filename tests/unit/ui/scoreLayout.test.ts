import { expect, test } from 'vitest'
import {
  getScoreCueX,
} from '../../../shared/ui/scoreLayout'

test('test_getScoreCueX_when_cue_starts_on_third_beat_then_returns_middle_of_note_area', () => {
  // Arrange
  const noteStartX = 100
  const noteEndX = 500

  // Act
  const result = getScoreCueX(3, noteStartX, noteEndX)

  // Assert
  expect(result).toBe(300)
})

test('test_getScoreCueX_when_beat_is_outside_measure_then_clamps_to_note_bounds', () => {
  // Arrange
  const noteStartX = 100
  const noteEndX = 500

  // Act
  const beforeMeasure = getScoreCueX(0, noteStartX, noteEndX)
  const afterMeasure = getScoreCueX(6, noteStartX, noteEndX)

  // Assert
  expect(beforeMeasure).toBe(noteStartX)
  expect(afterMeasure).toBe(noteEndX)
})
