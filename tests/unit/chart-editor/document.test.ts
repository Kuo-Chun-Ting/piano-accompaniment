import { describe, expect, test } from 'vitest'
import {
  addPlacement,
  buildEditorSelection,
  canArrangeDocument,
  createChartEditorDocument,
  deleteMeasure,
  deletePlacement,
  getInvalidMeasureIds,
  insertEmptyMeasure,
  insertPlacement,
  moveMeasure,
  movePlacement,
  updateMeasureLyric,
  updatePlacementChord,
  updatePlacementDuration,
} from '../../../shared/chart-editor/document'
import { ExtractedChartSchema } from '../../../shared/schemas/chart'
import type { ChartEditorDocument } from '../../../shared/chart-editor/types'

describe('chart editor document', () => {
  test('test_createChartEditorDocument_when_source_splits_two_plus_one_plus_one_then_groups_once', () => {
    // Arrange
    const chart = buildExtractedChart([
      buildMeasure(1, [['F', 2]]),
      buildMeasure(2, [['F/G', 1], ['G', 1]]),
    ])

    // Act
    const document = createChartEditorDocument(chart)

    // Assert
    expect(document.measures).toHaveLength(1)
    expect(document.measures[0].chords.map(chord => [chord.chord, chord.durationBeats]))
      .toEqual([['F', 2], ['F/G', 1], ['G', 1]])
  })

  test('test_createChartEditorDocument_when_total_overflows_then_keeps_values_and_marks_measure_invalid', () => {
    // Arrange
    const chart = buildExtractedChart([buildMeasure(1, [['C', 3], ['G', 2]])])

    // Act
    const document = createChartEditorDocument(chart)

    // Assert
    expect(document.measures[0].chords.map(chord => chord.durationBeats)).toEqual([3, 2])
    expect(getInvalidMeasureIds(document)).toEqual([document.measures[0].id])
  })

  test('test_getInvalidMeasureIds_when_chord_is_unsupported_then_marks_measure_invalid', () => {
    // Arrange
    const document = buildEditorDocument([['—:4']])

    // Act
    const invalidMeasureIds = getInvalidMeasureIds(document)

    // Assert
    expect(invalidMeasureIds).toEqual(['verse:measure:1'])
  })

  test('test_createChartEditorDocument_when_chart_has_multiple_sections_then_flattens_source_order', () => {
    // Arrange
    const first = buildSection('verse', 2, [buildMeasure(1, [['C', 4]])])
    const second = buildSection('intro', 1, [buildMeasure(1, [['G', 4]])])
    const chart = ExtractedChartSchema.parse(buildChart([first, second]))

    // Act
    const document = createChartEditorDocument(chart)

    // Assert
    expect(document.measures.map(measure => measure.sectionId)).toEqual(['intro', 'verse'])
    expect(document.measures.map(measure => measure.id)).toEqual([
      'intro:measure:1',
      'verse:measure:1',
    ])
  })

  test('test_addPlacement_when_measure_exists_then_appends_one_beat_empty_chord', () => {
    // Arrange
    const document = buildEditorDocument()

    // Act
    const result = addPlacement(document, 'verse:measure:1', 'placement:new')

    // Assert
    expect(result.measures[0].chords.at(-1)).toMatchObject({
      id: 'placement:new',
      chord: '',
      durationBeats: 1,
      wasEdited: true,
    })
    expect(result.measures.map(measure => measure.id)).toEqual(document.measures.map(measure => measure.id))
  })

  test('test_insertPlacement_when_position_is_before_then_inserts_next_to_reference_chord', () => {
    // Arrange
    const document = buildEditorDocument()

    // Act
    const result = insertPlacement(
      document,
      'verse:measure:1',
      'placement:2',
      'before',
      'placement:new',
    )

    // Assert
    expect(result.measures[0].chords.map(chord => chord.id)).toEqual([
      'placement:1',
      'placement:new',
      'placement:2',
    ])
    expect(result.measures[0].chords[1]).toMatchObject({
      chord: '',
      durationBeats: 1,
      wasEdited: true,
    })
  })

  test('test_deletePlacement_when_it_is_last_chord_then_keeps_empty_invalid_measure', () => {
    // Arrange
    const document = buildEditorDocument([['C:4'], ['G:4']])

    // Act
    const result = deletePlacement(document, 'placement:1')

    // Assert
    expect(result.measures[0].chords).toEqual([])
    expect(getInvalidMeasureIds(result)).toContain('verse:measure:1')
    expect(result.measures).toHaveLength(2)
  })

  test('test_updatePlacementFields_when_values_change_then_updates_only_selected_placement', () => {
    // Arrange
    const document = buildEditorDocument()

    // Act
    const withChord = updatePlacementChord(document, 'placement:1', 'Dm7')
    const withDuration = updatePlacementDuration(withChord, 'placement:1', 1)
    const result = updateMeasureLyric(withDuration, 'verse:measure:1', 'new lyric')

    // Assert
    expect(result.measures[0]).toMatchObject({ lyric: 'new lyric' })
    expect(result.measures[0].chords[0]).toMatchObject({
      chord: 'Dm7',
      durationBeats: 1,
      wasEdited: true,
    })
    expect(document.measures[0].chords[0]).toMatchObject({ chord: 'C', durationBeats: 2 })
  })

  test('test_movePlacement_when_target_is_another_measure_then_preserves_fixed_boundaries', () => {
    // Arrange
    const document = buildEditorDocument()

    // Act
    const result = movePlacement(document, 'placement:2', 'verse:measure:2', 1)

    // Assert
    expect(result.measures[0].chords.map(chord => chord.id)).toEqual(['placement:1'])
    expect(result.measures[1].chords.map(chord => chord.id)).toEqual(['placement:3', 'placement:2'])
    expect(result.measures.map(measure => measure.id)).toEqual([
      'verse:measure:1',
      'verse:measure:2',
    ])
  })

  test('test_movePlacement_when_moved_later_in_same_measure_then_uses_final_index', () => {
    // Arrange
    const document = buildEditorDocument([['C:1', 'G:1', 'Am:2']])

    // Act
    const result = movePlacement(document, 'placement:1', 'verse:measure:1', 2)

    // Assert
    expect(result.measures[0].chords.map(chord => chord.id)).toEqual([
      'placement:2',
      'placement:3',
      'placement:1',
    ])
  })

  test('test_movePlacement_when_placement_is_missing_then_returns_same_document', () => {
    // Arrange
    const document = buildEditorDocument()

    // Act
    const result = movePlacement(document, 'missing', 'verse:measure:2', 0)

    // Assert
    expect(result).toBe(document)
  })

  test('test_moveMeasure_when_moved_after_another_measure_then_moves_lyrics_and_chords_together', () => {
    // Arrange
    const document = buildEditorDocument([['C:4'], ['G:4'], ['Am:4']])
    document.measures[0].lyric = 'first lyric'

    // Act
    const result = moveMeasure(document, 'verse:measure:1', 3)

    // Assert
    expect(result.measures.map(measure => measure.id)).toEqual([
      'verse:measure:2',
      'verse:measure:3',
      'verse:measure:1',
    ])
    expect(result.measures[2]).toMatchObject({
      lyric: 'first lyric',
      chords: [expect.objectContaining({ chord: 'C' })],
    })
  })

  test('test_moveMeasure_when_source_precedes_target_then_adjusts_index_after_removal', () => {
    // Arrange
    const document = buildEditorDocument([['C:4'], ['G:4'], ['Am:4']])

    // Act
    const result = moveMeasure(document, 'verse:measure:1', 2)

    // Assert
    expect(result.measures.map(measure => measure.id)).toEqual([
      'verse:measure:2',
      'verse:measure:1',
      'verse:measure:3',
    ])
  })

  test('test_insertEmptyMeasure_when_inserted_before_then_preserves_other_measures', () => {
    // Arrange
    const document = buildEditorDocument()

    // Act
    const result = insertEmptyMeasure(
      document,
      'verse:measure:2',
      'before',
      'editor:new-measure:1',
    )

    // Assert
    expect(result.measures.map(measure => measure.id)).toEqual([
      'verse:measure:1',
      'editor:new-measure:1',
      'verse:measure:2',
    ])
    expect(result.measures[1]).toMatchObject({ lyric: null, chords: [] })
    expect(result.measures[0]).toEqual(document.measures[0])
    expect(result.measures[2]).toEqual(document.measures[1])
  })

  test('test_insertEmptyMeasure_when_inserted_after_then_preserves_other_measures', () => {
    // Arrange
    const document = buildEditorDocument()

    // Act
    const result = insertEmptyMeasure(
      document,
      'verse:measure:1',
      'after',
      'editor:new-measure:1',
    )

    // Assert
    expect(result.measures.map(measure => measure.id)).toEqual([
      'verse:measure:1',
      'editor:new-measure:1',
      'verse:measure:2',
    ])
    expect(result.measures[0]).toEqual(document.measures[0])
    expect(result.measures[2]).toEqual(document.measures[1])
  })

  test('test_insertEmptyMeasure_when_document_is_empty_then_uses_default_section', () => {
    // Arrange
    const document = buildEditorDocument([])

    // Act
    const result = insertEmptyMeasure(
      document,
      null,
      'after',
      'editor:new-measure:1',
    )

    // Assert
    expect(result.measures).toEqual([{
      id: 'editor:new-measure:1',
      sectionId: 'verse',
      sectionLabel: 'Verse',
      sectionOrder: 1,
      sourceIndex: 0,
      lyric: null,
      chords: [],
    }])
  })

  test('test_deleteMeasure_when_measure_has_content_then_removes_its_chords_and_lyrics', () => {
    // Arrange
    const document = buildEditorDocument()
    document.measures[0].lyric = 'removed lyric'

    // Act
    const result = deleteMeasure(document, 'verse:measure:1')

    // Assert
    expect(result.measures.map(measure => measure.id)).toEqual(['verse:measure:2'])
    expect(result.measures[0]).toEqual(document.measures[1])
  })

  test('test_deleteMeasure_when_it_is_the_last_measure_then_returns_empty_document', () => {
    // Arrange
    const document = buildEditorDocument([['C:4']])

    // Act
    const result = deleteMeasure(document, 'verse:measure:1')

    // Assert
    expect(result.measures).toEqual([])
  })

  test('test_canArrangeDocument_when_document_is_empty_then_returns_false', () => {
    // Arrange
    const document = buildEditorDocument([])

    // Act
    const result = canArrangeDocument(document)

    // Assert
    expect(result).toBe(false)
  })

  test('test_canArrangeDocument_when_measure_is_empty_then_returns_false', () => {
    // Arrange
    const document = buildEditorDocument([[]])

    // Act
    const result = canArrangeDocument(document)

    // Assert
    expect(result).toBe(false)
  })

  test('test_buildEditorSelection_when_measures_are_reordered_then_groups_and_renumbers_sections', () => {
    // Arrange
    const document = buildEditorDocument([['C:4'], ['G:4'], ['Am:4']])
    document.measures = [
      {
        ...document.measures[2],
        sectionId: 'chorus',
        sectionLabel: 'Chorus',
        sectionOrder: 2,
        lyric: 'chorus lyric',
      },
      {
        ...document.measures[1],
        lyric: 'second verse lyric',
      },
      {
        ...document.measures[0],
        lyric: 'first verse lyric',
      },
    ]

    // Act
    const selection = buildEditorSelection(document, 'C', 'flowing-narrative')

    // Assert
    expect(selection).toEqual({
      normalizedKey: 'C',
      mood: 'flowing-narrative',
      sections: [{
        id: 'chorus',
        label: 'Chorus',
        order: 2,
        measures: [{
          index: 1,
          lyric: 'chorus lyric',
          chords: [{
            chord: 'Am',
            durationBeats: 4,
            lyric: null,
            sourceChordConfidence: 'visible',
            sourceDurationConfidence: 'visible',
            sourceLyricConfidence: 'missing',
            wasEdited: false,
          }],
        }],
      }, {
        id: 'verse',
        label: 'Verse',
        order: 1,
        measures: [{
          index: 1,
          lyric: 'second verse lyric',
          chords: [{
            chord: 'G',
            durationBeats: 4,
            lyric: null,
            sourceChordConfidence: 'visible',
            sourceDurationConfidence: 'visible',
            sourceLyricConfidence: 'missing',
            wasEdited: false,
          }],
        }, {
          index: 2,
          lyric: 'first verse lyric',
          chords: [{
            chord: 'C',
            durationBeats: 4,
            lyric: null,
            sourceChordConfidence: 'visible',
            sourceDurationConfidence: 'visible',
            sourceLyricConfidence: 'missing',
            wasEdited: false,
          }],
        }],
      }],
    })
  })
})

function buildEditorDocument(
  measures = [['C:2', 'G:2'], ['Am:4']],
): ChartEditorDocument {
  let placementIndex = 0

  return {
    defaultSection: {
      id: 'verse',
      label: 'Verse',
      order: 1,
    },
    measures: measures.map((chords, measureIndex) => ({
      id: `verse:measure:${measureIndex + 1}`,
      sectionId: 'verse',
      sectionLabel: 'Verse',
      sectionOrder: 1,
      sourceIndex: measureIndex + 1,
      lyric: null,
      chords: chords.map((definition) => {
        placementIndex += 1
        const [chord, duration] = definition.split(':')
        return {
          id: `placement:${placementIndex}`,
          chord,
          durationBeats: Number(duration),
          lyric: null,
          sourceChordConfidence: 'visible',
          sourceDurationConfidence: 'visible',
          sourceLyricConfidence: 'missing',
          wasEdited: false,
        }
      }),
    })),
  }
}

function buildExtractedChart(measures: ReturnType<typeof buildMeasure>[]) {
  return ExtractedChartSchema.parse(buildChart([buildSection('verse', 1, measures)]))
}

function buildChart(sections: ReturnType<typeof buildSection>[]) {
  return {
    title: { value: 'Song', confidence: 'visible' },
    originalKey: { value: 'C', confidence: 'visible' },
    mode: { value: 'major', confidence: 'visible' },
    meter: { value: '4/4', confidence: 'visible' },
    tempo: { value: 73, confidence: 'visible' },
    moodRecommendation: {
      mood: 'spacious-ballad',
      confidence: 'visible',
      rationale: '',
    },
    sections,
    annotations: [],
    warnings: [],
  }
}

function buildSection(
  id: string,
  order: number,
  measures: ReturnType<typeof buildMeasure>[],
) {
  return {
    id,
    label: id,
    order,
    confidence: 'visible',
    measures,
  }
}

function buildMeasure(index: number, chords: Array<[string, number]>) {
  return {
    index,
    boundaryConfidence: 'visible',
    lyric: { value: null, confidence: 'missing' },
    chords: chords.map(([chord, durationBeats]) => ({
      chord: { value: chord, confidence: 'visible' },
      durationBeats: { value: durationBeats, confidence: 'visible' },
      lyric: { value: null, confidence: 'missing' },
    })),
  }
}
