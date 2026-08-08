import { describe, expect, test } from 'vitest'
import {
  CompactChartResponseSchema,
  expandCompactChartResponse,
} from '../../../server/services/compactChartResponse'

describe('compact chart response', () => {
  test('test_expandCompactChartResponse_when_measure_has_lyrics_then_assigns_them_to_the_measure', () => {
    // Arrange
    const response = CompactChartResponseSchema.parse(buildCompactChart())

    // Act
    const chart = expandCompactChartResponse(response)

    // Assert
    expect(chart.sections[0].measures[0].lyric).toEqual({
      value: '烏雲在我們心裡',
      confidence: 'visible',
    })
    expect(chart.sections[0].measures[0].chords.map(chord => chord.lyric.value))
      .toEqual(['烏雲在我們心裡', null])
  })

  test('test_expandCompactChartResponse_when_chord_uses_unicode_flat_then_normalizes_symbol', () => {
    // Arrange
    const response = CompactChartResponseSchema.parse(buildCompactChart('E♭/B♭'))

    // Act
    const chart = expandCompactChartResponse(response)

    // Assert
    expect(chart.sections[0].measures[0].chords[0].chord.value).toBe('Eb/Bb')
  })

  test('test_expandCompactChartResponse_when_fields_are_uncertain_or_missing_then_maps_confidence', () => {
    // Arrange
    const baseChart = buildCompactChart()
    const response = CompactChartResponseSchema.parse({
      ...baseChart,
      title: null,
      uncertainFields: ['title', 'originalKey'],
      moodRecommendation: {
        ...baseChart.moodRecommendation,
        uncertain: true,
      },
      sections: [{
        ...baseChart.sections[0],
        uncertain: true,
        measures: [{
          ...baseChart.sections[0].measures[0],
          boundaryUncertain: true,
          lyricUncertain: true,
          lyricVariants: ['烏雲在我心裡'],
          chords: [{
            symbol: 'C',
            beats: null,
            uncertainFields: ['symbol', 'beats'],
          }],
        }],
      }],
    })

    // Act
    const chart = expandCompactChartResponse(response)

    // Assert
    expect(chart.title).toEqual({ value: null, confidence: 'missing' })
    expect(chart.originalKey).toEqual({ value: 'C#', confidence: 'uncertain' })
    expect(chart.moodRecommendation.confidence).toBe('uncertain')
    expect(chart.sections[0].confidence).toBe('uncertain')
    expect(chart.sections[0].measures[0]).toMatchObject({
      boundaryConfidence: 'uncertain',
      lyric: {
        value: '烏雲在我們心裡',
        confidence: 'uncertain',
      },
      lyricVariants: ['烏雲在我心裡'],
    })
    expect(chart.sections[0].measures[0].chords[0]).toMatchObject({
      chord: { value: 'C', confidence: 'uncertain' },
      durationBeats: { value: null, confidence: 'missing' },
      lyric: {
        value: '烏雲在我們心裡',
        confidence: 'uncertain',
      },
    })
  })

  test('test_expandCompactChartResponse_when_section_label_is_blank_then_uses_section_order', () => {
    // Arrange
    const baseChart = buildCompactChart()
    const response = CompactChartResponseSchema.parse({
      ...baseChart,
      sections: [{
        ...baseChart.sections[0],
        label: '   ',
      }],
    })

    // Act
    const chart = expandCompactChartResponse(response)

    // Assert
    expect(chart.sections[0].label).toBe('Section 1')
  })
})

function buildCompactChart(firstChord = 'C') {
  return {
    title: '楓',
    originalKey: 'C#',
    mode: 'major',
    meter: '4/4',
    tempo: 68,
    uncertainFields: [],
    moodRecommendation: {
      mood: 'spacious-ballad',
      uncertain: false,
      rationale: '',
    },
    sections: [{
      id: 'section-1',
      label: 'Verse',
      order: 1,
      uncertain: false,
      measures: [{
        index: 1,
        boundaryUncertain: false,
        lyric: '烏雲在我們心裡',
        lyricVariants: [],
        lyricUncertain: false,
        chords: [
          { symbol: firstChord, beats: 2, uncertainFields: [] },
          { symbol: 'G', beats: 2, uncertainFields: [] },
        ],
      }],
    }],
    annotations: [],
    warnings: [],
  }
}
