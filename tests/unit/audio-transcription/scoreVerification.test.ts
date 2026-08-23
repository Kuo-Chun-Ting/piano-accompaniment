import { expect, test } from 'vitest'
import type { ScoreEvent, ScoreVersion } from '../../../shared/arrangement/types'
import {
  verifyScoreNotation,
  verifyScorePlayback,
} from '../../../shared/audio-transcription/scoreVerification'

test('test_verifyScorePlayback_when_score_has_missing_and_extra_notes_then_reports_both_differences', () => {
  // Arrange
  const version = buildVersion([
    buildEvent(1, 1, ['C4']),
    buildEvent(2, 1, ['E4']),
    buildEvent(3, 2, []),
  ])

  // Act
  const result = verifyScorePlayback({
    version,
    bpm: 60,
    originSeconds: 0,
    notes: [
      { midi: 60, startSeconds: 0, endSeconds: 1, velocity: 80 },
      { midi: 67, startSeconds: 1, endSeconds: 2, velocity: 72 },
    ],
    pedalEvents: [],
  })

  // Assert
  expect(result.issues).toEqual([
    expect.objectContaining({ kind: 'unexpected-note', pitch: 'E4' }),
    expect.objectContaining({ kind: 'missing-note', pitch: 'G4' }),
  ])
})

test('test_verifyScorePlayback_when_pedal_release_is_late_then_reports_sustain_difference', () => {
  // Arrange
  const version = {
    ...buildVersion([
      buildEvent(1, 1, ['C4']),
      buildEvent(2, 3, []),
    ]),
    pedalIntervals: [{ startBeatOffset: 0.5, endBeatOffset: 3 }],
  }

  // Act
  const result = verifyScorePlayback({
    version,
    bpm: 60,
    originSeconds: 0,
    notes: [
      { midi: 60, startSeconds: 0, endSeconds: 1, velocity: 80 },
    ],
    pedalEvents: [
      { timeSeconds: 0.5, value: 127 },
      { timeSeconds: 2, value: 0 },
    ],
  })

  // Assert
  expect(result.issues).toEqual([
    expect.objectContaining({
      kind: 'sustain-duration',
      pitch: 'C4',
      expectedSeconds: 2,
      actualSeconds: 3,
    }),
  ])
})

test('test_verifyScoreNotation_when_measure_tie_and_pedal_are_invalid_then_reports_each_issue', () => {
  // Arrange
  const version = {
    ...buildVersion([
      { ...buildEvent(1, 2, ['C4']), tieToNextPitches: ['E4'] },
      buildEvent(3, 1, ['D4']),
    ]),
    pedalIntervals: [{ startBeatOffset: 3, endBeatOffset: 2 }],
  }

  // Act
  const result = verifyScoreNotation(version)

  // Assert
  expect(result.issues).toEqual([
    expect.objectContaining({ kind: 'measure-duration', hand: 'right', measureIndex: 1 }),
    expect.objectContaining({ kind: 'invalid-tie', pitch: 'E4', measureIndex: 1 }),
    expect.objectContaining({ kind: 'invalid-pedal-interval' }),
  ])
})

function buildVersion(rightHand: ReturnType<typeof buildEvent>[]): ScoreVersion {
  return {
    level: 'rich',
    measures: [{
      sectionId: 'test',
      sectionLabel: 'Test',
      index: 1,
      chordSymbols: [],
      lyrics: [],
      intensity: 'medium',
      rightHand,
      leftHand: [buildEvent(1, 4, [])],
    }],
  }
}

function buildEvent(startBeat: number, durationBeats: number, pitches: string[]): ScoreEvent {
  return {
    startBeat,
    durationBeats,
    pitches,
    fingers: [],
    tieToNext: false,
  }
}
