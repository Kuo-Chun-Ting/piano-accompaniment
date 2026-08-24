import { expect, test } from 'vitest'
import type { ScoreMeasure } from '../../../shared/arrangement/types'
import type { PlaybackPosition } from '../../../shared/audio/playbackSchedule'
import {
  buildScoreSystems,
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

test('test_getScoreSystemProgress_when_position_is_inside_system_then_returns_relative_progress', () => {
  // Arrange
  const system = {
    startMeasureIndex: 4,
    measures: [buildMeasure(4), buildMeasure(5), buildMeasure(6), buildMeasure(7)],
  }
  const position = buildPlaybackPosition(5, 0.5)

  // Act
  const progress = getScoreSystemProgress(system, position)

  // Assert
  expect(progress).toBe(0.375)
})

test('test_getScoreSystemProgress_when_position_is_outside_system_then_clamps_progress', () => {
  // Arrange
  const system = {
    startMeasureIndex: 4,
    measures: [buildMeasure(4), buildMeasure(5)],
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
  }

  // Act
  const target = getScoreSystemSeekTarget(system, 0.375)

  // Assert
  expect(target).toEqual({
    measureIndex: 5,
    measureProgress: 0.5,
  })
})

test('test_getScoreSystemSeekTarget_when_progress_is_complete_then_maps_to_final_measure_end', () => {
  // Arrange
  const system = {
    startMeasureIndex: 8,
    measures: [buildMeasure(8), buildMeasure(9)],
  }

  // Act
  const target = getScoreSystemSeekTarget(system, 1)

  // Assert
  expect(target).toEqual({
    measureIndex: 9,
    measureProgress: 1,
  })
})
