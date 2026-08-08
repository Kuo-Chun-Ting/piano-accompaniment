import { describe, expect, test } from 'vitest'
import type { ConfirmedChart } from '../../../shared/schemas/chart'
import { transposeConfirmedChart } from '../../../shared/music/transposition'

describe('chart transposition', () => {
  test('test_transposeConfirmedChart_when_g_major_chart_then_transposes_chords_to_c_major', () => {
    // Arrange
    const chart = buildConfirmedChart('G', 'C', ['G', 'D/F#'])

    // Act
    const result = transposeConfirmedChart(chart)

    // Assert
    expect(result.sections[0].measures[0].chords.map((placement) => placement.chord)).toEqual(['C', 'G/B'])
  })

  test('test_transposeConfirmedChart_when_e_minor_chart_then_transposes_chords_to_a_minor', () => {
    // Arrange
    const chart = buildConfirmedChart('Em', 'Am', ['Em', 'C'])

    // Act
    const result = transposeConfirmedChart(chart)

    // Assert
    expect(result.sections[0].measures[0].chords.map((placement) => placement.chord)).toEqual(['Am', 'F'])
  })

  test('test_transposeConfirmedChart_when_chromatic_chord_then_preserves_readable_note_spelling', () => {
    // Arrange
    const chart = buildConfirmedChart('G', 'C', ['F'])

    // Act
    const result = transposeConfirmedChart(chart)

    // Assert
    expect(result.sections[0].measures[0].chords[0].chord).toBe('Bb')
  })

  test('test_transposeConfirmedChart_when_91pu_chord_uses_unicode_flat_then_transposes_chord', () => {
    // Arrange
    const chart = buildConfirmedChart('F', 'C', ['E♭', '(B♭)/D'])

    // Act
    const result = transposeConfirmedChart(chart)

    // Assert
    expect(result.sections[0].measures[0].chords.map((placement) => placement.chord)).toEqual(['Bb', 'F/A'])
  })

  test('test_transposeConfirmedChart_when_dominant_ninth_or_thirteenth_then_preserves_quality', () => {
    // Arrange
    const chart = buildConfirmedChart('G', 'C', ['D9', 'G13'])

    // Act
    const result = transposeConfirmedChart(chart)

    // Assert
    expect(result.sections[0].measures[0].chords.map((placement) => placement.chord)).toEqual(['G9', 'C13'])
  })

  test('test_transposeConfirmedChart_when_91pu_uses_flat_ninth_suffix_then_preserves_quality', () => {
    // Arrange
    const chart = buildConfirmedChart('C', 'C', ['B7-9'])

    // Act
    const result = transposeConfirmedChart(chart)

    // Assert
    expect(result.sections[0].measures[0].chords[0].chord).toBe('B7-9')
  })

  test('test_transposeConfirmedChart_when_original_key_is_unsupported_then_throws_key_error', () => {
    // Arrange
    const chart = buildConfirmedChart('H', 'C', ['C'])

    // Act & Assert
    expect(() => transposeConfirmedChart(chart)).toThrow('Unsupported original key: H')
  })

  test('test_transposeConfirmedChart_when_chord_is_unsupported_then_throws_chord_error', () => {
    // Arrange
    const chart = buildConfirmedChart('C', 'C', ['H13'])

    // Act & Assert
    expect(() => transposeConfirmedChart(chart)).toThrow('Unsupported chord: H13')
  })
})

function buildConfirmedChart(originalKey: string, normalizedKey: 'C' | 'Am', chords: string[]): ConfirmedChart {
  return {
    title: 'Song',
    originalKey,
    mode: normalizedKey === 'C' ? 'major' : 'minor',
    normalizedKey,
    meter: '4/4',
    tempo: 72,
    mood: 'spacious-ballad',
    sections: [{
      id: 'verse',
      label: 'Verse',
      order: 1,
      measures: [{
        index: 1,
        lyric: null,
        chords: chords.map((chord) => ({
          chord,
          durationBeats: 4 / chords.length,
          lyric: null,
          sourceChordConfidence: 'visible',
          sourceDurationConfidence: 'visible',
          sourceLyricConfidence: 'visible',
          wasEdited: false,
        })),
      }],
    }],
  }
}
