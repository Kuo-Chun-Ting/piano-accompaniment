import { expect, test } from 'vitest'
import {
  DEFAULT_CHART_READING_MODEL,
  buildChartReadingStatusText,
  isChartReadingModelId,
} from '../../../shared/ui/chartReading'

test('test_isChartReadingModelId_when_model_is_supported_then_returns_true', () => {
  // Arrange
  const modelId = 'gpt-5.6-sol'

  // Act
  const result = isChartReadingModelId(modelId)

  // Assert
  expect(result).toBe(true)
})

test('test_isChartReadingModelId_when_model_is_unknown_then_returns_false', () => {
  // Arrange
  const modelId = 'gpt-5.5-mini'

  // Act
  const result = isChartReadingModelId(modelId)

  // Assert
  expect(result).toBe(false)
})

test('test_defaultChartReadingModel_when_loaded_then_uses_balanced_model', () => {
  // Assert
  expect(DEFAULT_CHART_READING_MODEL).toBe('gpt-5.5')
})

test('test_buildChartReadingStatusText_when_reading_is_idle_then_returns_null', () => {
  // Act
  const result = buildChartReadingStatusText({ state: 'idle', elapsedSeconds: 0 })

  // Assert
  expect(result).toBeNull()
})

test('test_buildChartReadingStatusText_when_reading_is_active_then_returns_analysis_time', () => {
  // Act
  const result = buildChartReadingStatusText({ state: 'reading', elapsedSeconds: 84 })

  // Assert
  expect(result).toBe('Analyzing 01:24')
})

test('test_buildChartReadingStatusText_when_reading_succeeds_then_returns_final_time', () => {
  // Act
  const result = buildChartReadingStatusText({ state: 'success', elapsedSeconds: 84 })

  // Assert
  expect(result).toBe('Analyzed in 01:24')
})

test('test_buildChartReadingStatusText_when_reading_fails_then_returns_failure_time', () => {
  // Act
  const result = buildChartReadingStatusText({ state: 'failed', elapsedSeconds: 8 })

  // Assert
  expect(result).toBe('Failed after 00:08')
})
