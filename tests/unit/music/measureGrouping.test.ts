import { describe, expect, test } from 'vitest'
import {
  groupMeasuresByDuration,
  groupSectionsIntoMeasures,
} from '../../../shared/music/measureGrouping'
import type { ConfirmedChordPlacement, ConfirmedSection } from '../../../shared/schemas/chart'

describe('measure grouping', () => {
  test('test_groupSectionsIntoMeasures_when_interlude_durations_are_corrected_then_returns_eight_measures', () => {
    // Arrange
    const section = buildSection([
      ['C:4'],
      ['G:4'],
      ['Am7:4'],
      ['D7:4'],
      ['C:4'],
      ['G:1'],
      ['D/F#:1', 'Em:1', 'D:1'],
      ['C:2', 'D7:2'],
      ['G:4'],
    ])

    // Act
    const result = groupSectionsIntoMeasures([section])

    // Assert
    expect(result.issues).toEqual([])
    expect(result.sections[0].measures).toHaveLength(8)
    expect(result.sections[0].measures[5].chords.map((placement) => placement.chord)).toEqual([
      'G',
      'D/F#',
      'Em',
      'D',
    ])
  })

  test('test_groupSectionsIntoMeasures_when_chord_crosses_measure_boundary_then_returns_overflow_issue', () => {
    // Arrange
    const section = buildSection([['C:3', 'G:2']])

    // Act
    const result = groupSectionsIntoMeasures([section])

    // Assert
    expect(result.issues).toEqual([{
      sectionId: 'interlude-1',
      measureIndex: 1,
      type: 'overflow',
      totalBeats: 5,
    }])
    expect(result.sections[0].measures[0].chords.map((placement) => placement.chord)).toEqual(['C', 'G'])
  })

  test('test_groupSectionsIntoMeasures_when_section_ends_before_four_beats_then_returns_incomplete_issue', () => {
    // Arrange
    const section = buildSection([['C:1', 'G:1', 'Am:1']])

    // Act
    const result = groupSectionsIntoMeasures([section])

    // Assert
    expect(result.issues).toEqual([{
      sectionId: 'interlude-1',
      measureIndex: 1,
      type: 'incomplete',
      totalBeats: 3,
    }])
  })

  test('test_groupSectionsIntoMeasures_when_source_measure_has_lyric_then_carries_lyric_to_grouped_measure', () => {
    // Arrange
    const section = buildSection([
      ['C:4|烏雲在我們心裡'],
      ['G/B:4|擱下一塊陰影'],
      ['F/A:4|我聆聽沉寂已久'],
      ['C/G:2', 'C:2|的心情'],
    ])

    // Act
    const result = groupSectionsIntoMeasures([section])

    // Assert
    expect(result.issues).toEqual([])
    expect(result.sections[0].measures.map((measure) => measure.lyric)).toEqual([
      '烏雲在我們心裡',
      '擱下一塊陰影',
      '我聆聽沉寂已久',
      '的心情',
    ])
  })

  test('test_groupSectionsIntoMeasures_when_91pu_short_bar_continues_then_merges_into_one_measure', () => {
    // Arrange
    const section = buildSection([
      ['F:2'],
      ['F/G:1', 'G:1'],
    ])

    // Act
    const result = groupSectionsIntoMeasures([section])

    // Assert
    expect(result.issues).toEqual([])
    expect(result.sections[0].measures).toHaveLength(1)
    expect(result.sections[0].measures[0].chords.map((placement) => placement.chord)).toEqual(['F', 'F/G', 'G'])
    expect(result.sections[0].measures[0].chords.map((placement) => placement.durationBeats)).toEqual([2, 1, 1])
  })

  test('test_groupSectionsIntoMeasures_when_merged_lyrics_include_uncertainty_then_preserves_review_state', () => {
    // Arrange
    const sourceMeasures = [{
      lyric: '緩緩飄落',
      sourceLyricConfidence: 'visible' as const,
      lyricConfirmedByUser: true,
      chords: [{ durationBeats: 2 }],
    }, {
      lyric: '的楓葉像思念',
      sourceLyricConfidence: 'uncertain' as const,
      lyricConfirmedByUser: false,
      chords: [{ durationBeats: 2 }],
    }]

    // Act
    const result = groupMeasuresByDuration('verse', sourceMeasures)

    // Assert
    expect(result.measures[0]).toMatchObject({
      lyric: '緩緩飄落的楓葉像思念',
      sourceLyricConfidence: 'uncertain',
      lyricConfirmedByUser: false,
    })
  })
})

function buildSection(measures: string[][]): ConfirmedSection {
  return {
    id: 'interlude-1',
    label: '[間奏1]',
    order: 1,
    measures: measures.map((chords, measureIndex) => ({
      index: measureIndex + 1,
      lyric: chords.map(parseLyric).find(Boolean) ?? null,
      chords: chords.map(buildPlacement),
    })),
  }
}

function buildPlacement(value: string): ConfirmedChordPlacement {
  const [timing] = value.split('|')
  const [chord, durationBeats] = timing.split(':')
  return {
    chord,
    durationBeats: Number(durationBeats),
    lyric: parseLyric(value),
    sourceChordConfidence: 'visible',
    sourceDurationConfidence: 'visible',
    sourceLyricConfidence: parseLyric(value) ? 'visible' : 'missing',
    wasEdited: true,
  }
}

function parseLyric(value: string): string | null {
  return value.split('|')[1] ?? null
}
