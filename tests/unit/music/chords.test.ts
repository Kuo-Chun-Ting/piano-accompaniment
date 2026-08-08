import { describe, expect, test } from 'vitest'
import { getChordToneNames, normalizeChordSymbol, parseChordSymbol } from '../../../shared/music/chords'

describe('chord parsing', () => {
  test('test_parseChordSymbol_when_major_chord_then_returns_major_quality', () => {
    // Arrange
    const symbol = 'C'

    // Act
    const chord = parseChordSymbol(symbol)

    // Assert
    expect(chord).toMatchObject({ root: 'C', quality: 'major', bass: null })
  })

  test('test_parseChordSymbol_when_minor_slash_chord_then_returns_bass_note', () => {
    // Arrange
    const symbol = 'Am/E'

    // Act
    const chord = parseChordSymbol(symbol)

    // Assert
    expect(chord).toMatchObject({ root: 'A', quality: 'minor', bass: 'E' })
  })

  test('test_getChordToneNames_when_add9_chord_then_includes_second_color', () => {
    // Arrange
    const chord = parseChordSymbol('Cadd9')

    // Act
    const tones = chord ? getChordToneNames(chord) : []

    // Assert
    expect(tones).toEqual(['C', 'E', 'G', 'D'])
  })

  test('test_parseChordSymbol_when_dominant_seventh_sus4_chord_then_returns_supported_quality', () => {
    // Arrange
    const symbol = 'D7sus4'

    // Act
    const chord = parseChordSymbol(symbol)

    // Assert
    expect(chord).toMatchObject({ root: 'D', quality: 'dominant7sus4', bass: null })
  })

  test('test_getChordToneNames_when_dominant_seventh_sus4_chord_then_returns_suspended_seventh_tones', () => {
    // Arrange
    const chord = parseChordSymbol('D7sus4')

    // Act
    const tones = chord ? getChordToneNames(chord) : []

    // Assert
    expect(tones).toEqual(['D', 'G', 'A', 'C'])
  })

  test('test_getChordToneNames_when_flat_chord_then_returns_flat_spelling', () => {
    // Arrange
    const chord = parseChordSymbol('Bb')

    // Act
    const tones = chord ? getChordToneNames(chord) : []

    // Assert
    expect(tones).toEqual(['Bb', 'D', 'F'])
  })

  test('test_normalizeChordSymbol_when_91pu_uses_music_accidentals_then_returns_ascii_symbol', () => {
    // Arrange
    const symbols = ['E♭', 'B♭sus4', 'D7/F♯', 'A♭/C']

    // Act
    const normalizedSymbols = symbols.map(normalizeChordSymbol)

    // Assert
    expect(normalizedSymbols).toEqual(['Eb', 'Bbsus4', 'D7/F#', 'Ab/C'])
  })

  test('test_normalizeChordSymbol_when_91pu_wraps_optional_chord_then_removes_outer_parentheses', () => {
    // Arrange
    const symbol = '(A♭)'

    // Act
    const normalizedSymbol = normalizeChordSymbol(symbol)

    // Assert
    expect(normalizedSymbol).toBe('Ab')
  })

  test('test_parseChordSymbol_when_slash_chord_uses_any_supported_bass_note_then_returns_bass_note', () => {
    // Arrange
    const symbols = ['G/F', 'Bb/D', 'E♭/G']

    // Act
    const chords = symbols.map(parseChordSymbol)

    // Assert
    expect(chords.map((chord) => chord && { root: chord.root, bass: chord.bass })).toEqual([
      { root: 'G', bass: 'F' },
      { root: 'Bb', bass: 'D' },
      { root: 'Eb', bass: 'G' },
    ])
  })

  test('test_parseChordSymbol_when_dominant_ninth_or_thirteenth_then_returns_supported_quality', () => {
    // Arrange
    const symbols = ['C9', 'C13']

    // Act
    const qualities = symbols.map((symbol) => parseChordSymbol(symbol)?.quality)

    // Assert
    expect(qualities).toEqual(['dominant9', 'dominant13'])
  })

  test('test_parseChordSymbol_when_91pu_uses_flat_ninth_suffix_then_returns_supported_quality', () => {
    // Arrange
    const symbol = 'B7-9'

    // Act
    const chord = parseChordSymbol(symbol)

    // Assert
    expect(chord).toMatchObject({ root: 'B', quality: 'dominant7Flat9', bass: null })
  })

  test('test_parseChordSymbol_when_91pu_uses_minor_seventh_flat_fifth_then_returns_supported_quality', () => {
    // Arrange
    const symbol = 'F#m7-5'

    // Act
    const chord = parseChordSymbol(symbol)

    // Assert
    expect(chord).toMatchObject({ root: 'F#', quality: 'minor7Flat5', bass: null })
  })

  test('test_getChordToneNames_when_dominant_ninth_or_thirteenth_then_returns_extended_tones', () => {
    // Arrange
    const ninth = parseChordSymbol('C9')
    const thirteenth = parseChordSymbol('C13')

    // Act
    const ninthTones = ninth ? getChordToneNames(ninth) : []
    const thirteenthTones = thirteenth ? getChordToneNames(thirteenth) : []

    // Assert
    expect(ninthTones).toEqual(['C', 'E', 'G', 'Bb', 'D'])
    expect(thirteenthTones).toEqual(['C', 'E', 'G', 'Bb', 'D', 'A'])
  })

  test('test_getChordToneNames_when_dominant_flat_ninth_then_returns_flat_ninth_tones', () => {
    // Arrange
    const chord = parseChordSymbol('B7-9')

    // Act
    const tones = chord ? getChordToneNames(chord) : []

    // Assert
    expect(tones).toEqual(['B', 'D#', 'F#', 'A', 'C'])
  })

  test('test_getChordToneNames_when_minor_seventh_flat_fifth_then_returns_half_diminished_tones', () => {
    // Arrange
    const chord = parseChordSymbol('F#m7-5')

    // Act
    const tones = chord ? getChordToneNames(chord) : []

    // Assert
    expect(tones).toEqual(['F#', 'A', 'C', 'E'])
  })

  test('test_parseChordSymbol_when_symbol_is_unsupported_then_returns_null', () => {
    // Arrange
    const symbol = 'H13'

    // Act
    const chord = parseChordSymbol(symbol)

    // Assert
    expect(chord).toBeNull()
  })
})
