import { expect, test } from 'vitest'
import type { ScoreEvent, ScoreMeasure, ScoreVersion } from '../../../shared/arrangement/types'
import {
  buildPlaybackPosition,
  buildPlaybackSchedule,
  getMeasureSeekSeconds,
  retimePlaybackSeconds,
} from '../../../shared/audio/playbackSchedule'

test('test_buildPlaybackSchedule_when_score_has_two_measures_then_offsets_second_measure', () => {
  // Arrange
  const version = buildScoreVersion([
    buildMeasure(
      [buildEvent(1, 1, ['C4'])],
      [buildEvent(1, 2, ['C3'])],
    ),
    buildMeasure([], [buildEvent(2, 2, ['G2'])]),
  ])

  // Act
  const schedule = buildPlaybackSchedule(version, 120)

  // Assert
  expect(schedule.events).toEqual([
    {
      id: 'measure-0-right-0',
      measureIndex: 0,
      hand: 'right',
      eventIndex: 0,
      startBeat: 1,
      durationBeats: 1,
      startSeconds: 0,
      durationSeconds: 0.5,
      pitches: ['C4'],
    },
    {
      id: 'measure-0-left-0',
      measureIndex: 0,
      hand: 'left',
      eventIndex: 0,
      startBeat: 1,
      durationBeats: 2,
      startSeconds: 0,
      durationSeconds: 1,
      pitches: ['C3'],
    },
    {
      id: 'measure-1-left-0',
      measureIndex: 1,
      hand: 'left',
      eventIndex: 0,
      startBeat: 2,
      durationBeats: 2,
      startSeconds: 2.5,
      durationSeconds: 1,
      pitches: ['G2'],
    },
  ])
  expect(schedule.totalDurationSeconds).toBe(4)
})

test('test_buildPlaybackSchedule_when_tied_note_crosses_measure_then_schedules_one_continuous_event', () => {
  // Arrange
  const version = buildScoreVersion([
    buildMeasure([
      buildEvent(1, 2, []),
      buildEvent(3, 2, ['C4'], true),
    ], []),
    buildMeasure([
      buildEvent(1, 2, ['C4'], false, true),
      buildEvent(3, 2, []),
    ], []),
  ])

  // Act
  const schedule = buildPlaybackSchedule(version, 120)

  // Assert
  expect(schedule.events.filter(event => event.pitches.length > 0)).toEqual([{
    id: 'measure-0-right-1',
    measureIndex: 0,
    hand: 'right',
    eventIndex: 1,
    startBeat: 3,
    durationBeats: 4,
    startSeconds: 1,
    durationSeconds: 2,
    pitches: ['C4'],
  }])
})

test('test_buildPlaybackSchedule_when_next_note_is_not_tied_from_previous_then_keeps_repeated_attack', () => {
  // Arrange
  const version = buildScoreVersion([
    buildMeasure([
      buildEvent(1, 2, ['C4'], true),
      buildEvent(3, 2, ['C4']),
    ], []),
  ])

  // Act
  const schedule = buildPlaybackSchedule(version, 120)

  // Assert
  expect(schedule.events.filter(event => event.pitches.length > 0)).toHaveLength(2)
})

test('test_buildPlaybackSchedule_when_note_releases_under_pedal_then_sustains_until_pedal_up', () => {
  // Arrange
  const version: ScoreVersion = {
    ...buildScoreVersion([
      buildMeasure([buildEvent(1, 1, ['C4'])], []),
    ]),
    pedalIntervals: [{ startBeatOffset: 0.5, endBeatOffset: 3 }],
  }

  // Act
  const schedule = buildPlaybackSchedule(version, 60)

  // Assert
  expect(schedule.events.find(event => event.pitches.length > 0)).toMatchObject({
    durationBeats: 3,
    durationSeconds: 3,
  })
})

test('test_buildPlaybackPosition_when_playing_inside_measure_then_returns_measure_and_active_events', () => {
  // Arrange
  const schedule = buildPlaybackSchedule(buildScoreVersion([
    buildMeasure([buildEvent(1, 4, ['C4'])], [buildEvent(1, 2, ['C3'])]),
    buildMeasure([buildEvent(1, 4, ['G4'])], []),
  ]), 60)

  // Act
  const position = buildPlaybackPosition(schedule, 1.5)

  // Assert
  expect(position).toEqual({
    elapsedSeconds: 1.5,
    totalDurationSeconds: 8,
    progress: 0.1875,
    measureIndex: 0,
    measureProgress: 0.375,
    beat: 2.5,
    activeEventIds: ['measure-0-right-0', 'measure-0-left-0'],
  })
})

test('test_buildPlaybackPosition_when_event_reaches_end_then_excludes_event', () => {
  // Arrange
  const schedule = buildPlaybackSchedule(buildScoreVersion([
    buildMeasure([buildEvent(1, 2, ['C4'])], []),
  ]), 60)

  // Act
  const position = buildPlaybackPosition(schedule, 2)

  // Assert
  expect(position.activeEventIds).toEqual([])
})

test('test_buildPlaybackPosition_when_elapsed_exceeds_score_then_clamps_to_end', () => {
  // Arrange
  const schedule = buildPlaybackSchedule(buildScoreVersion([
    buildMeasure([buildEvent(1, 4, ['C4'])], []),
    buildMeasure([buildEvent(1, 4, ['G4'])], []),
  ]), 120)

  // Act
  const position = buildPlaybackPosition(schedule, 10)

  // Assert
  expect(position).toEqual({
    elapsedSeconds: 4,
    totalDurationSeconds: 4,
    progress: 1,
    measureIndex: 1,
    measureProgress: 1,
    beat: 4,
    activeEventIds: [],
  })
})

test('test_getMeasureSeekSeconds_when_position_is_inside_measure_then_returns_absolute_seconds', () => {
  // Act
  const seekSeconds = getMeasureSeekSeconds(2, 0.625, 120)

  // Assert
  expect(seekSeconds).toBe(5.25)
})

test('test_getMeasureSeekSeconds_when_progress_is_outside_measure_then_clamps_progress', () => {
  // Act
  const beforeMeasure = getMeasureSeekSeconds(2, -0.5, 120)
  const afterMeasure = getMeasureSeekSeconds(2, 1.5, 120)

  // Assert
  expect(beforeMeasure).toBe(4)
  expect(afterMeasure).toBe(6)
})

test('test_retimePlaybackSeconds_when_bpm_changes_then_preserves_absolute_beat', () => {
  // Arrange
  const elapsedAt73Bpm = 8 * (60 / 73)

  // Act
  const elapsedAt100Bpm = retimePlaybackSeconds(elapsedAt73Bpm, 60 / 73, 100)

  // Assert
  expect(elapsedAt100Bpm).toBeCloseTo(8 * (60 / 100))
})

function buildScoreVersion(measures: ScoreMeasure[]): ScoreVersion {
  return {
    level: 'easy',
    measures,
  }
}

function buildMeasure(rightHand: ScoreEvent[], leftHand: ScoreEvent[]): ScoreMeasure {
  return {
    sectionId: 'section',
    sectionLabel: 'Section',
    index: 1,
    chordSymbols: [],
    lyrics: [],
    intensity: 'medium',
    rightHand,
    leftHand,
  }
}

function buildEvent(
  startBeat: number,
  durationBeats: number,
  pitches: string[],
  tieToNext = false,
  tieFromPrevious = false,
): ScoreEvent {
  return {
    startBeat,
    durationBeats,
    pitches,
    fingers: [],
    tieToNext,
    ...(tieFromPrevious ? { tieFromPrevious } : {}),
  }
}
