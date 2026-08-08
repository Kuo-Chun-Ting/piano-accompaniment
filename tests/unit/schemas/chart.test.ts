import { describe, expect, test } from 'vitest'
import {
  ExtractedChartSchema,
  ParseChartRequestSchema,
  buildConfirmedChart,
} from '../../../shared/schemas/chart'

describe('chart schemas', () => {
  test('test_ExtractedChartSchema_when_chord_and_duration_have_separate_confidence_then_parses_data', () => {
    // Arrange
    const chart = buildExtractedChart()

    // Act
    const result = ExtractedChartSchema.safeParse(chart)

    // Assert
    expect(result.success).toBe(true)
  })

  test('test_ParseChartRequestSchema_when_image_order_is_missing_then_rejects_data', () => {
    // Arrange
    const request = {
      images: [{ filename: 'chart.png', dataUrl: 'data:image/png;base64,abc' }],
    }

    // Act
    const result = ParseChartRequestSchema.safeParse(request)

    // Assert
    expect(result.success).toBe(false)
  })

  test('test_ParseChartRequestSchema_when_model_is_missing_then_rejects_data', () => {
    // Arrange
    const request = {
      images: [{ filename: 'chart.png', dataUrl: 'data:image/png;base64,abc', order: 0 }],
    }

    // Act
    const result = ParseChartRequestSchema.safeParse(request)

    // Assert
    expect(result.success).toBe(false)
  })

  test('test_ParseChartRequestSchema_when_supported_model_is_provided_then_accepts_model', () => {
    // Arrange
    const request = {
      model: 'gpt-5.6-sol',
      images: [{ filename: 'chart.png', dataUrl: 'data:image/png;base64,abc', order: 0 }],
    }

    // Act
    const result = ParseChartRequestSchema.safeParse(request)

    // Assert
    expect(result.data).toMatchObject({ model: 'gpt-5.6-sol' })
  })

  test('test_ParseChartRequestSchema_when_unknown_model_is_provided_then_rejects_data', () => {
    // Arrange
    const request = {
      model: 'gpt-5.5-mini',
      images: [{ filename: 'chart.png', dataUrl: 'data:image/png;base64,abc', order: 0 }],
    }

    // Act
    const result = ParseChartRequestSchema.safeParse(request)

    // Assert
    expect(result.success).toBe(false)
  })

  test('test_ParseChartRequestSchema_when_filename_is_missing_then_rejects_image', () => {
    // Arrange
    const request = {
      images: [{
        order: 0,
        dataUrl: 'data:image/jpeg;base64,abc',
      }],
    }

    // Act
    const result = ParseChartRequestSchema.safeParse(request)

    // Assert
    expect(result.success).toBe(false)
  })

  test('test_buildConfirmedChart_when_measure_totals_four_beats_then_returns_confirmed_chart', () => {
    // Arrange
    const extractedChart = ExtractedChartSchema.parse(buildExtractedChart())

    // Act
    const chart = buildConfirmedChart({
      extractedChart,
      normalizedKey: 'C',
      mood: 'spacious-ballad',
      sections: extractedChart.sections.map((section) => ({
        id: section.id,
        label: section.label,
        order: section.order,
        measures: section.measures.map((measure) => ({
          index: measure.index,
          lyric: measure.lyric.value,
          chords: measure.chords.map((placement) => ({
            chord: placement.chord.value || '',
            durationBeats: placement.durationBeats.value || 0,
            lyric: placement.lyric.value,
            sourceChordConfidence: placement.chord.confidence,
            sourceDurationConfidence: placement.durationBeats.confidence,
            sourceLyricConfidence: placement.lyric.confidence,
            wasEdited: false,
          })),
        })),
      })),
    })

    // Assert
    expect(chart.sections[0].measures[0].lyric).toBe('hello')
    expect(chart.sections[0].measures[0].chords).toHaveLength(2)
    expect(chart.sections[0].measures[0].chords[0].lyric).toBe('hello')
    expect(chart.mood).toBe('spacious-ballad')
    expect(chart.tempo).toBe(73)
  })

  test('test_buildConfirmedChart_when_measure_does_not_total_four_beats_then_throws_error', () => {
    // Arrange
    const extractedChart = ExtractedChartSchema.parse(buildExtractedChart())
    const sections = [{
      id: 'verse',
      label: 'Verse',
      order: 1,
      measures: [{
        index: 1,
        lyric: null,
        chords: [{
          chord: 'G',
          durationBeats: 3,
          lyric: null,
          sourceChordConfidence: 'visible' as const,
          sourceDurationConfidence: 'visible' as const,
          sourceLyricConfidence: 'visible' as const,
          wasEdited: true,
        }],
      }],
    }]

    // Act & Assert
    expect(() => buildConfirmedChart({
      extractedChart,
      normalizedKey: 'C',
      mood: 'spacious-ballad',
      sections,
    })).toThrow('Each measure must total exactly four beats')
  })

  test('test_buildConfirmedChart_when_original_key_is_missing_then_throws_required_key_error', () => {
    // Arrange
    const baseChart = ExtractedChartSchema.parse(buildExtractedChart())
    const extractedChart = ExtractedChartSchema.parse({
      ...baseChart,
      originalKey: { value: null, confidence: 'missing' },
    })

    // Act & Assert
    expect(() => buildConfirmedChart({
      extractedChart,
      normalizedKey: 'C',
      mood: 'spacious-ballad',
      sections: buildConfirmedSections(),
    })).toThrow('Original key is required before generating accompaniment')
  })

  test('test_buildConfirmedChart_when_normalized_key_is_a_minor_then_sets_minor_mode', () => {
    // Arrange
    const extractedChart = ExtractedChartSchema.parse(buildExtractedChart())

    // Act
    const result = buildConfirmedChart({
      extractedChart,
      normalizedKey: 'Am',
      mood: 'spacious-ballad',
      sections: buildConfirmedSections(),
    })

    // Assert
    expect(result.mode).toBe('minor')
    expect(result.normalizedKey).toBe('Am')
  })
})

function buildConfirmedSections() {
  return [{
    id: 'verse',
    label: 'Verse',
    order: 1,
    measures: [{
      index: 1,
      lyric: 'hello',
      chords: [{
        chord: 'G',
        durationBeats: 4,
        lyric: 'hello',
        sourceChordConfidence: 'visible' as const,
        sourceDurationConfidence: 'visible' as const,
        sourceLyricConfidence: 'visible' as const,
        wasEdited: false,
      }],
    }],
  }]
}

function buildExtractedChart(): unknown {
  return {
    title: { value: 'Song', confidence: 'visible' },
    originalKey: { value: 'G', confidence: 'visible' },
    mode: { value: 'major', confidence: 'visible' },
    meter: { value: '4/4', confidence: 'visible' },
    tempo: { value: 73, confidence: 'visible' },
    moodRecommendation: {
      mood: 'spacious-ballad',
      confidence: 'visible',
      rationale: 'Slow tempo and lyrical phrasing.',
    },
    sections: [{
      id: 'verse',
      label: 'Verse',
      order: 1,
      confidence: 'visible',
      measures: [{
        index: 1,
        boundaryConfidence: 'visible',
        lyric: { value: 'hello', confidence: 'visible' },
        chords: [
          {
            chord: { value: 'G', confidence: 'visible' },
            durationBeats: { value: 2, confidence: 'visible' },
            lyric: { value: 'hello', confidence: 'visible' },
          },
          {
            chord: { value: 'D', confidence: 'visible' },
            durationBeats: { value: 2, confidence: 'uncertain' },
            lyric: { value: null, confidence: 'visible' },
          },
        ],
      }],
    }],
    annotations: [],
    warnings: [],
  }
}
