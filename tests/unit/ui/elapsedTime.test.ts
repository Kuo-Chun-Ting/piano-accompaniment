import { expect, test } from 'vitest'
import { formatElapsedTime } from '../../../shared/ui/elapsedTime'

test('test_formatElapsedTime_when_duration_is_zero_then_returns_zero_timestamp', () => {
  // Act
  const result = formatElapsedTime(0)

  // Assert
  expect(result).toBe('00:00')
})

test('test_formatElapsedTime_when_duration_is_under_one_minute_then_returns_padded_seconds', () => {
  // Act
  const result = formatElapsedTime(59)

  // Assert
  expect(result).toBe('00:59')
})

test('test_formatElapsedTime_when_duration_crosses_minutes_then_returns_minutes_and_seconds', () => {
  // Act
  const result = formatElapsedTime(125)

  // Assert
  expect(result).toBe('02:05')
})

test('test_formatElapsedTime_when_duration_is_negative_or_fractional_then_normalizes_seconds', () => {
  // Act
  const negative = formatElapsedTime(-3)
  const fractional = formatElapsedTime(5.9)

  // Assert
  expect(negative).toBe('00:00')
  expect(fractional).toBe('00:05')
})
