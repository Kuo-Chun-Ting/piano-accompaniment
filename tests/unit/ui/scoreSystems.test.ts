import { expect, test } from 'vitest'
import type { ScoreMeasure } from '../../../shared/arrangement/types'
import type { PlaybackPosition } from '../../../shared/audio/playbackSchedule'
import {
  buildScoreSystems,
  fitTextWithinBounds,
  getScoreSystemMeasureWidths,
  getScoreSystemProgress,
  getScoreSystemSeekTarget,
  groupScoreMeasures,
} from '../../../shared/ui/scoreSystems'

function buildMeasure(index: number): ScoreMeasure {
  return {
    sectionId: 'song',
    sectionLabel: '',
    index,
    chordSymbols: ['C'],
    lyrics: [],
    intensity: 'medium',
    staves: [
      {
        id: 'treble',
        clef: 'treble',
        voices: [{ id: 'treble-1', events: [{ startBeat: 1, durationBeats: 4, notes: [] }] }],
      },
      {
        id: 'bass',
        clef: 'bass',
        voices: [{ id: 'bass-1', events: [{ startBeat: 1, durationBeats: 4, notes: [] }] }],
      },
    ],
  }
}

function buildPlaybackPosition(
  measureIndex: number,
  measureProgress: number,
): PlaybackPosition {
  return {
    elapsedSeconds: 0,
    totalDurationSeconds: 0,
    progress: 0,
    measureIndex,
    measureProgress,
    beat: 1,
    activeEventIds: [],
  }
}

test('test_groupScoreMeasures_when_measure_count_exceeds_system_size_then_groups_continuously', () => {
  // Arrange
  const measures = Array.from({ length: 10 }, (_, index) => buildMeasure(index))

  // Act
  const systems = groupScoreMeasures(measures, 4)

  // Assert
  expect(systems.map(system => ({
    startMeasureIndex: system.startMeasureIndex,
    measureCount: system.measures.length,
  }))).toEqual([
    { startMeasureIndex: 0, measureCount: 4 },
    { startMeasureIndex: 4, measureCount: 4 },
    { startMeasureIndex: 8, measureCount: 2 },
  ])
})

test('test_groupScoreMeasures_when_system_size_is_zero_then_returns_no_systems', () => {
  // Arrange
  const measures = [buildMeasure(0)]

  // Act
  const systems = groupScoreMeasures(measures, 0)

  // Assert
  expect(systems).toEqual([])
})

test('test_buildScoreSystems_when_score_has_many_measures_then_uses_four_measures_per_system', () => {
  // Arrange
  const measures = Array.from({ length: 66 }, (_, index) => buildMeasure(index))

  // Act
  const systems = buildScoreSystems(measures)

  // Assert
  expect(systems).toHaveLength(17)
  expect(systems[0].measures).toHaveLength(4)
  expect(systems.at(-1)?.measures).toHaveLength(2)
})

test('test_buildScoreSystems_when_measure_is_dense_then_gives_it_more_space_and_wraps_earlier', () => {
  // Arrange
  const measures = Array.from({ length: 4 }, (_, index) => buildMeasure(index))
  measures[0]!.staves[0]!.voices[0]!.events = Array.from({ length: 16 }, (_, index) => ({
    startBeat: 1 + index * 0.25,
    durationBeats: 0.25,
    notes: [{ pitch: 'C5' }],
  }))

  // Act
  const systems = buildScoreSystems(measures)

  // Assert
  expect(systems.map(system => system.measures.length)).toEqual([3, 1])
  expect(systems[0]!.measureLayoutUnits).toEqual([2, 1, 1])
})

test('test_buildScoreSystems_when_both_staves_have_distinct_rhythmic_positions_then_counts_combined_density', () => {
  // Arrange
  const measures = Array.from({ length: 4 }, (_, index) => buildMeasure(index))
  measures[0]!.staves[0]!.voices[0]!.events = Array.from({ length: 6 }, (_, index) => ({
    startBeat: 1 + index * 0.25,
    durationBeats: 0.25,
    notes: [{ pitch: 'C5' }],
  }))
  measures[0]!.staves[1]!.voices[0]!.events = Array.from({ length: 6 }, (_, index) => ({
    startBeat: 2.5 + index * 0.25,
    durationBeats: 0.25,
    notes: [{ pitch: 'C3' }],
  }))

  // Act
  const systems = buildScoreSystems(measures)

  // Assert
  expect(systems[0]!.measureLayoutUnits).toEqual([2, 1, 1])
})

test('test_getScoreSystemMeasureWidths_when_final_system_is_short_then_keeps_standard_measure_width', () => {
  // Arrange
  const system = {
    startMeasureIndex: 4,
    measures: [buildMeasure(4)],
    measureLayoutUnits: [1],
    isFinalSystem: true,
  }

  // Act
  const widths = getScoreSystemMeasureWidths(system, 1000)

  // Assert
  expect(widths).toEqual([250])
})

test('test_getScoreSystemMeasureWidths_when_non_final_system_wraps_early_then_fills_content_width', () => {
  // Arrange
  const measures = Array.from({ length: 4 }, (_, index) => buildMeasure(index))
  measures[3]!.staves[0]!.voices[0]!.events = Array.from({ length: 16 }, (_, index) => ({
    startBeat: 1 + index * 0.25,
    durationBeats: 0.25,
    notes: [{ pitch: 'C5' }],
  }))
  const firstSystem = buildScoreSystems(measures)[0]!

  // Act
  const widths = getScoreSystemMeasureWidths(firstSystem, 1000)

  // Assert
  expect(widths).toEqual([
    1000 / 3,
    1000 / 3,
    1000 / 3,
  ])
  expect(widths.reduce((total, width) => total + width, 0)).toBe(1000)
})

test('test_fitTextWithinBounds_when_text_would_overflow_right_edge_then_shifts_it_left', () => {
  // Arrange & Act
  const x = fitTextWithinBounds(900, 280, 40, 1000)

  // Assert
  expect(x).toBe(720)
})

test('test_getScoreSystemProgress_when_position_is_inside_system_then_returns_relative_progress', () => {
  // Arrange
  const system = {
    startMeasureIndex: 4,
    measures: [buildMeasure(4), buildMeasure(5), buildMeasure(6), buildMeasure(7)],
    measureLayoutUnits: [1, 1, 1, 1],
    isFinalSystem: false,
  }
  const position = buildPlaybackPosition(5, 0.5)

  // Act
  const progress = getScoreSystemProgress(system, position)

  // Assert
  expect(progress).toBe(0.375)
})

test('test_getScoreSystemProgress_when_measure_widths_differ_then_uses_layout_units', () => {
  // Arrange
  const system = {
    startMeasureIndex: 4,
    measures: [buildMeasure(4), buildMeasure(5), buildMeasure(6)],
    measureLayoutUnits: [2, 1, 1],
    isFinalSystem: false,
  }
  const position = buildPlaybackPosition(4, 0.5)

  // Act
  const progress = getScoreSystemProgress(system, position)

  // Assert
  expect(progress).toBe(0.25)
})

test('test_getScoreSystemProgress_when_final_system_is_short_then_matches_rendered_measure_width', () => {
  // Arrange
  const system = {
    startMeasureIndex: 8,
    measures: [buildMeasure(8)],
    measureLayoutUnits: [1],
    isFinalSystem: true,
  }
  const position = buildPlaybackPosition(8, 0.5)

  // Act
  const progress = getScoreSystemProgress(system, position)

  // Assert
  expect(progress).toBe(0.125)
})

test('test_getScoreSystemProgress_when_position_is_outside_system_then_clamps_progress', () => {
  // Arrange
  const system = {
    startMeasureIndex: 4,
    measures: [buildMeasure(4), buildMeasure(5)],
    measureLayoutUnits: [1, 1],
    isFinalSystem: false,
  }

  // Act
  const beforeProgress = getScoreSystemProgress(system, buildPlaybackPosition(2, 0.5))
  const afterProgress = getScoreSystemProgress(system, buildPlaybackPosition(7, 0.5))

  // Assert
  expect(beforeProgress).toBe(0)
  expect(afterProgress).toBe(1)
})

test('test_getScoreSystemSeekTarget_when_progress_is_inside_system_then_maps_to_measure_position', () => {
  // Arrange
  const system = {
    startMeasureIndex: 4,
    measures: [buildMeasure(4), buildMeasure(5), buildMeasure(6), buildMeasure(7)],
    measureLayoutUnits: [1, 1, 1, 1],
    isFinalSystem: false,
  }

  // Act
  const target = getScoreSystemSeekTarget(system, 0.375)

  // Assert
  expect(target).toEqual({
    measureIndex: 5,
    measureProgress: 0.5,
  })
})

test('test_getScoreSystemSeekTarget_when_measure_widths_differ_then_uses_layout_units', () => {
  // Arrange
  const system = {
    startMeasureIndex: 4,
    measures: [buildMeasure(4), buildMeasure(5), buildMeasure(6)],
    measureLayoutUnits: [2, 1, 1],
    isFinalSystem: false,
  }

  // Act
  const target = getScoreSystemSeekTarget(system, 0.25)

  // Assert
  expect(target).toEqual({
    measureIndex: 4,
    measureProgress: 0.5,
  })
})

test('test_getScoreSystemSeekTarget_when_final_system_is_short_then_matches_rendered_measure_width', () => {
  // Arrange
  const system = {
    startMeasureIndex: 8,
    measures: [buildMeasure(8)],
    measureLayoutUnits: [1],
    isFinalSystem: true,
  }

  // Act
  const insideMeasure = getScoreSystemSeekTarget(system, 0.125)
  const afterMeasure = getScoreSystemSeekTarget(system, 0.75)

  // Assert
  expect(insideMeasure).toEqual({
    measureIndex: 8,
    measureProgress: 0.5,
  })
  expect(afterMeasure).toEqual({
    measureIndex: 8,
    measureProgress: 1,
  })
})

test('test_getScoreSystemSeekTarget_when_progress_is_complete_then_maps_to_final_measure_end', () => {
  // Arrange
  const system = {
    startMeasureIndex: 8,
    measures: [buildMeasure(8), buildMeasure(9)],
    measureLayoutUnits: [1, 1],
    isFinalSystem: true,
  }

  // Act
  const target = getScoreSystemSeekTarget(system, 1)

  // Assert
  expect(target).toEqual({
    measureIndex: 9,
    measureProgress: 1,
  })
})
