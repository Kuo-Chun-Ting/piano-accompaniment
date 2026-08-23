import { describe, expect, test } from 'vitest'
import {
  convertTranscriptionToScore,
  midiNumberToPitch,
} from '../../../shared/audio-transcription/midiToScore'

describe('midiToScore', () => {
  test('test_midiNumberToPitch_when_midi_number_is_valid_then_returns_scientific_pitch', () => {
    // Arrange
    const midiNumbers = [40, 60, 61, 84]

    // Act
    const pitches = midiNumbers.map(midi => midiNumberToPitch(midi))

    // Assert
    expect(pitches).toEqual(['E2', 'C4', 'C#4', 'C6'])
  })

  test('test_convertTranscriptionToScore_when_note_is_short_then_quantizes_to_eighth_note', () => {
    // Arrange
    const input = buildInput([
      { midi: 60, startSeconds: 0, endSeconds: 0.24, velocity: 80 },
    ])

    // Act
    const result = convertTranscriptionToScore(input)

    // Assert
    expect(result.measures[0]?.rightHand[0]).toMatchObject({
      startBeat: 1,
      durationBeats: 0.5,
      pitches: ['C4'],
    })
  })

  test('test_convertTranscriptionToScore_when_release_leaves_eighth_note_gap_then_preserves_rest', () => {
    // Arrange
    const input = buildInput([
      { midi: 60, startSeconds: 0, endSeconds: 0.24, velocity: 80 },
      { midi: 62, startSeconds: 0.5, endSeconds: 0.74, velocity: 80 },
    ])

    // Act
    const result = convertTranscriptionToScore(input)

    // Assert
    expect(result.measures[0]?.rightHand.slice(0, 3)).toEqual([
      expect.objectContaining({ startBeat: 1, durationBeats: 0.5, pitches: ['C4'] }),
      expect.objectContaining({ startBeat: 1.5, durationBeats: 0.5, pitches: [] }),
      expect.objectContaining({ startBeat: 2, durationBeats: 0.5, pitches: ['D4'] }),
    ])
  })

  test('test_convertTranscriptionToScore_when_notes_start_together_then_builds_one_chord_event', () => {
    // Arrange
    const input = buildInput([
      { midi: 60, startSeconds: 0, endSeconds: 0.5, velocity: 80 },
      { midi: 64, startSeconds: 0, endSeconds: 0.5, velocity: 76 },
      { midi: 67, startSeconds: 0, endSeconds: 0.5, velocity: 72 },
    ])

    // Act
    const result = convertTranscriptionToScore(input)

    // Assert
    expect(result.measures[0]?.rightHand[0]?.pitches).toEqual(['C4', 'E4', 'G4'])
  })

  test('test_convertTranscriptionToScore_when_sustained_note_overlaps_new_onset_then_marks_partial_ties', () => {
    // Arrange
    const input = buildInput([
      { midi: 84, startSeconds: 0, endSeconds: 1.5, velocity: 80 },
      { midi: 76, startSeconds: 0.5, endSeconds: 1, velocity: 76 },
      { midi: 83, startSeconds: 0.5, endSeconds: 1, velocity: 72 },
    ])

    // Act
    const result = convertTranscriptionToScore(input)

    // Assert
    expect(result.measures[0]?.rightHand.filter(event => event.pitches.length > 0)).toEqual([
      expect.objectContaining({
        startBeat: 1,
        durationBeats: 1,
        pitches: ['C6'],
        tieToNextPitches: ['C6'],
      }),
      expect.objectContaining({
        startBeat: 2,
        durationBeats: 1,
        pitches: ['E5', 'B5', 'C6'],
        tieFromPreviousPitches: ['C6'],
        tieToNextPitches: ['C6'],
      }),
      expect.objectContaining({
        startBeat: 3,
        durationBeats: 1,
        pitches: ['C6'],
        tieFromPreviousPitches: ['C6'],
      }),
    ])
  })

  test('test_convertTranscriptionToScore_when_notes_are_above_middle_c_then_keeps_them_in_right_hand', () => {
    // Arrange
    const input = buildInput([
      { midi: 60, startSeconds: 0, endSeconds: 0.5, velocity: 80 },
      { midi: 84, startSeconds: 0, endSeconds: 0.5, velocity: 80 },
    ])

    // Act
    const result = convertTranscriptionToScore(input)

    // Assert
    expect(result.measures[0]?.leftHand[0]?.pitches).toEqual([])
    expect(result.measures[0]?.rightHand[0]?.pitches).toEqual(['C4', 'C6'])
  })

  test('test_convertTranscriptionToScore_when_note_has_precise_timing_then_preserves_playback_note', () => {
    // Arrange
    const input = {
      ...buildInput([
        { midi: 60, startSeconds: 1.25, endSeconds: 2.1, velocity: 83 },
      ], 4, 1),
      bpm: 60,
    }

    // Act
    const result = convertTranscriptionToScore(input)

    // Assert
    expect(result.playbackNotes).toEqual([{
      pitch: 'C4',
      startBeatOffset: 0.25,
      durationBeats: expect.closeTo(0.85),
      velocity: 83,
    }])
  })

  test('test_convertTranscriptionToScore_when_notes_cross_middle_c_then_keeps_register_boundary', () => {
    // Arrange
    const input = buildInput([
      { midi: 41, startSeconds: 0, endSeconds: 0.5, velocity: 80 },
      { midi: 57, startSeconds: 0, endSeconds: 0.5, velocity: 80 },
      { midi: 72, startSeconds: 0, endSeconds: 0.5, velocity: 80 },
    ])

    // Act
    const result = convertTranscriptionToScore(input)

    // Assert
    expect(result.measures[0]?.leftHand[0]?.pitches).toEqual(['F2', 'A3'])
    expect(result.measures[0]?.rightHand[0]?.pitches).toEqual(['C5'])
  })

  test('test_convertTranscriptionToScore_when_low_notes_exceed_hand_span_then_keeps_them_in_left_hand', () => {
    // Arrange
    const input = buildInput([
      { midi: 41, startSeconds: 0, endSeconds: 0.5, velocity: 80 },
      { midi: 57, startSeconds: 0, endSeconds: 0.5, velocity: 80 },
    ])

    // Act
    const result = convertTranscriptionToScore(input)

    // Assert
    expect(result.measures[0]?.leftHand[0]?.pitches).toEqual(['F2', 'A3'])
    expect(result.measures[0]?.rightHand[0]?.pitches).toEqual([])
  })

  test('test_convertTranscriptionToScore_when_notes_span_middle_c_then_splits_hands', () => {
    // Arrange
    const input = buildInput([
      { midi: 48, startSeconds: 0, endSeconds: 0.5, velocity: 80 },
      { midi: 72, startSeconds: 0, endSeconds: 0.5, velocity: 80 },
    ])

    // Act
    const result = convertTranscriptionToScore(input)

    // Assert
    expect(result.measures[0]?.leftHand[0]?.pitches).toEqual(['C3'])
    expect(result.measures[0]?.rightHand[0]?.pitches).toEqual(['C5'])
  })

  test('test_convertTranscriptionToScore_when_note_crosses_measure_then_marks_notation_segments_tied', () => {
    // Arrange
    const input = buildInput([
      { midi: 60, startSeconds: 1.75, endSeconds: 2.25, velocity: 80 },
    ], 2.5)

    // Act
    const result = convertTranscriptionToScore(input)

    // Assert
    expect(result.measures).toHaveLength(2)
    expect(result.measures[0]?.rightHand.at(-1)).toMatchObject({
      startBeat: 4.5,
      durationBeats: 0.5,
      pitches: ['C4'],
      tieToNext: true,
    })
    expect(result.measures[1]?.rightHand[0]).toMatchObject({
      startBeat: 1,
      durationBeats: 0.5,
      pitches: ['C4'],
      tieFromPrevious: true,
    })
  })

  test('test_convertTranscriptionToScore_when_score_is_built_then_each_hand_fills_every_measure', () => {
    // Arrange
    const input = buildInput([
      { midi: 48, startSeconds: 0, endSeconds: 0.5, velocity: 80 },
      { midi: 67, startSeconds: 0.75, endSeconds: 1.25, velocity: 80 },
      { midi: 72, startSeconds: 2.25, endSeconds: 2.75, velocity: 80 },
    ], 3)

    // Act
    const result = convertTranscriptionToScore(input)

    // Assert
    for (const measure of result.measures) {
      expect(sumDurations(measure.leftHand)).toBe(4)
      expect(sumDurations(measure.rightHand)).toBe(4)
    }
  })

  test('test_convertTranscriptionToScore_when_first_downbeat_is_provided_then_aligns_score_origin', () => {
    // Arrange
    const input = buildInput([
      { midi: 60, startSeconds: 0.5, endSeconds: 1, velocity: 80 },
    ], 2.5, 0.5)

    // Act
    const result = convertTranscriptionToScore(input)

    // Assert
    expect(result.measures[0]?.rightHand[0]).toMatchObject({
      startBeat: 1,
      pitches: ['C4'],
    })
  })

  test('test_convertTranscriptionToScore_when_detected_measures_end_before_last_note_then_keeps_complete_transcription', () => {
    // Arrange
    const input = {
      ...buildInput([
        { midi: 60, startSeconds: 0, endSeconds: 0.5, velocity: 80 },
        { midi: 64, startSeconds: 4.5, endSeconds: 5, velocity: 80 },
      ], 5),
      measureCount: 2,
    }

    // Act
    const result = convertTranscriptionToScore(input)

    // Assert
    expect(result.measures).toHaveLength(3)
    expect(result.measures[2]?.rightHand.some(event => event.pitches.includes('E4'))).toBe(true)
  })

  test('test_convertTranscriptionToScore_when_pedal_events_are_provided_then_aligns_interval_to_score_beats', () => {
    // Arrange
    const input = {
      ...buildInput([
        { midi: 60, startSeconds: 0.5, endSeconds: 1, velocity: 80 },
      ], 3, 0.5),
      pedalEvents: [
        { timeSeconds: 0.75, value: 127 },
        { timeSeconds: 1.5, value: 0 },
      ],
    }

    // Act
    const result = convertTranscriptionToScore(input)

    // Assert
    expect(result.pedalIntervals).toEqual([{
      startBeatOffset: 0.5,
      endBeatOffset: 2,
    }])
  })

  test('test_convertTranscriptionToScore_when_notes_match_flat_key_then_adds_key_signature_and_flat_spelling', () => {
    // Arrange
    const input = buildInput(
      [58, 60, 62, 63, 65, 67, 69].map((midi, index) => ({
        midi,
        startSeconds: index * 0.25,
        endSeconds: index * 0.25 + 0.24,
        velocity: 80,
      })),
    )

    // Act
    const result = convertTranscriptionToScore(input)

    // Assert
    const pitches = result.measures.flatMap(measure => [
      ...measure.leftHand.flatMap(event => event.pitches),
      ...measure.rightHand.flatMap(event => event.pitches),
    ])
    expect(result.keySignature).toBe('Bb')
    expect(pitches).toContain('Bb3')
    expect(pitches).toContain('Eb4')
  })

  test('test_convertTranscriptionToScore_when_lyric_starts_after_downbeat_then_places_it_in_matching_measure', () => {
    // Arrange
    const input = {
      ...buildInput([
        { midi: 60, startSeconds: 1, endSeconds: 1.5, velocity: 80 },
      ], 6, 1),
      lyricSegments: [{
        startSeconds: 3.25,
        endSeconds: 4,
        text: '只剩下鋼琴陪我談了一天',
      }],
    }

    // Act
    const result = convertTranscriptionToScore(input)

    // Assert
    expect(result.measures[0]?.lyrics).toEqual([])
    expect(result.measures[1]?.lyrics).toEqual([{
      startBeat: 1.5,
      text: '只剩下鋼琴陪我談了一天',
    }])
    expect(result.measures[2]?.lyrics).toEqual([])
  })

  test('test_convertTranscriptionToScore_when_lyric_is_outside_score_then_does_not_assign_wrong_measure', () => {
    // Arrange
    const input = {
      ...buildInput([
        { midi: 60, startSeconds: 0, endSeconds: 0.5, velocity: 80 },
      ], 2),
      lyricSegments: [{
        startSeconds: 10,
        endSeconds: 11,
        text: '不屬於這份錄音',
      }],
    }

    // Act
    const result = convertTranscriptionToScore(input)

    // Assert
    expect(result.measures.flatMap(measure => measure.lyrics)).toEqual([])
  })

  test('test_convertTranscriptionToScore_when_downbeats_drift_then_uses_detected_measure_boundary_for_lyric', () => {
    // Arrange
    const input = {
      ...buildInput([
        { midi: 60, startSeconds: 0, endSeconds: 0.5, velocity: 80 },
      ], 4),
      downbeatSeconds: [0, 1.8, 3.6],
      lyricSegments: [{
        startSeconds: 1.95,
        endSeconds: 2.8,
        text: '落在第二小節',
      }],
    }

    // Act
    const result = convertTranscriptionToScore(input)

    // Assert
    expect(result.measures[0]?.lyrics).toEqual([])
    expect(result.measures[1]?.lyrics).toEqual([{
      startBeat: 1.5,
      text: '落在第二小節',
    }])
  })
})

function buildInput(
  notes: Array<{ midi: number, startSeconds: number, endSeconds: number, velocity: number }>,
  durationSeconds = 2,
  firstDownbeatSeconds = 0,
) {
  return {
    notes,
    bpm: 120,
    durationSeconds,
    firstDownbeatSeconds,
  }
}

function sumDurations(events: Array<{ durationBeats: number }>): number {
  return events.reduce((sum, event) => sum + event.durationBeats, 0)
}
