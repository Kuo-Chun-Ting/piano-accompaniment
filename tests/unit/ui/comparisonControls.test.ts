import { expect, test } from 'vitest'
import { adjustImageZoom, clampPanePercent } from '../../../shared/ui/comparisonControls'

test('test_clampPanePercent_when_value_is_below_minimum_then_returns_minimum', () => {
  // Arrange
  const value = 10

  // Act
  const result = clampPanePercent(value)

  // Assert
  expect(result).toBe(28)
})

test('test_clampPanePercent_when_value_is_above_maximum_then_returns_maximum', () => {
  // Arrange
  const value = 90

  // Act
  const result = clampPanePercent(value)

  // Assert
  expect(result).toBe(72)
})

test('test_clampPanePercent_when_value_is_within_range_then_preserves_value', () => {
  // Arrange
  const value = 43

  // Act
  const result = clampPanePercent(value)

  // Assert
  expect(result).toBe(43)
})

test('test_adjustImageZoom_when_result_is_below_minimum_then_returns_minimum', () => {
  // Arrange
  const currentZoom = 0.5

  // Act
  const result = adjustImageZoom(currentZoom, -0.25)

  // Assert
  expect(result).toBe(0.5)
})

test('test_adjustImageZoom_when_result_is_above_maximum_then_returns_maximum', () => {
  // Arrange
  const currentZoom = 2

  // Act
  const result = adjustImageZoom(currentZoom, 0.25)

  // Assert
  expect(result).toBe(2)
})

test('test_adjustImageZoom_when_result_is_within_range_then_applies_delta', () => {
  // Arrange
  const currentZoom = 1

  // Act
  const result = adjustImageZoom(currentZoom, 0.25)

  // Assert
  expect(result).toBe(1.25)
})
