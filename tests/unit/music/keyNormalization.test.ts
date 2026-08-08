import { describe, expect, test } from 'vitest'
import { normalizeKeySelection } from '../../../shared/music/keyNormalization'

describe('key normalization', () => {
  test('test_normalizeKeySelection_when_major_mode_then_returns_c_major', () => {
    // Arrange
    const input = { originalKey: 'G', selectedMode: 'major' as const }

    // Act
    const result = normalizeKeySelection(input)

    // Assert
    expect(result.normalizedKey).toBe('C')
    expect(result.displayOriginalKey).toBe('G')
  })

  test('test_normalizeKeySelection_when_minor_mode_then_returns_a_minor', () => {
    // Arrange
    const input = { originalKey: 'Em', selectedMode: 'minor' as const }

    // Act
    const result = normalizeKeySelection(input)

    // Assert
    expect(result.normalizedKey).toBe('Am')
    expect(result.displayOriginalKey).toBe('Em')
  })
})
