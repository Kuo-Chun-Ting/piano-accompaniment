import { describe, expect, test } from 'vitest'
import {
  convertTranscriptionToScore,
  midiNumberToPitch,
  simplifyTiedEvents,
} from '../../../shared/audio-transcription/midiToScore'
import type { ScoreEvent } from '../../../shared/arrangement/types'

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
    expect(getVoiceEvents(result.measures[0], 'bass')[0]).toMatchObject({
      startBeat: 1,
      durationBeats: 0.5,
      notes: [{ pitch: 'C4' }],
    })
  })

  test('test_convertTranscriptionToScore_when_release_leaves_eighth_note_gap_then_preserves_rest', () => {
    // Arrange
    const input = buildInput([
      { midi: 67, startSeconds: 0, endSeconds: 0.24, velocity: 80 },
      { midi: 69, startSeconds: 0.5, endSeconds: 0.74, velocity: 80 },
    ])

    // Act
    const result = convertTranscriptionToScore(input)

    // Assert
    expect(getVoiceEvents(result.measures[0], 'treble').slice(0, 3)).toEqual([
      expect.objectContaining({ startBeat: 1, durationBeats: 0.5, notes: [{ pitch: 'G4' }] }),
      expect.objectContaining({ startBeat: 1.5, durationBeats: 0.5, notes: [] }),
      expect.objectContaining({ startBeat: 2, durationBeats: 0.5, notes: [{ pitch: 'A4' }] }),
    ])
  })

  test('test_convertTranscriptionToScore_when_notes_start_together_then_builds_one_chord_event', () => {
    // Arrange
    const input = buildInput([
      { midi: 67, startSeconds: 0, endSeconds: 0.5, velocity: 80 },
      { midi: 72, startSeconds: 0, endSeconds: 0.5, velocity: 76 },
      { midi: 76, startSeconds: 0, endSeconds: 0.5, velocity: 72 },
    ])

    // Act
    const result = convertTranscriptionToScore(input)

    // Assert
    expect(getVoiceEvents(result.measures[0], 'treble')[0]?.notes.map(note => note.pitch))
      .toEqual(['G4', 'C5', 'E5'])
  })

  test('test_convertTranscriptionToScore_when_note_onsets_are_within_fifty_milliseconds_then_groups_one_chord_attack', () => {
    // Arrange
    const input = buildInput([
      { midi: 67, startSeconds: 0.11, endSeconds: 0.5, velocity: 80 },
      { midi: 72, startSeconds: 0.15, endSeconds: 0.5, velocity: 76 },
    ])

    // Act
    const result = convertTranscriptionToScore(input)

    // Assert
    const soundingEvents = getVoiceEvents(result.measures[0], 'treble')
      .filter(event => event.notes.length > 0)
    expect(soundingEvents).toHaveLength(1)
    expect(soundingEvents[0]!.notes).toEqual([{ pitch: 'G4' }, { pitch: 'C5' }])
  })

  test('test_convertTranscriptionToScore_when_note_onsets_are_eighty_milliseconds_apart_then_keeps_one_chord_attack', () => {
    // Arrange
    const input = buildInput([
      { midi: 67, startSeconds: 0.11, endSeconds: 0.5, velocity: 80 },
      { midi: 72, startSeconds: 0.19, endSeconds: 0.5, velocity: 76 },
    ])

    // Act
    const result = convertTranscriptionToScore(input)

    // Assert
    const soundingEvents = getVoiceEvents(result.measures[0], 'treble')
      .filter(event => event.notes.length > 0)
    expect(soundingEvents).toHaveLength(1)
    expect(soundingEvents[0]!.notes).toEqual([{ pitch: 'G4' }, { pitch: 'C5' }])
  })

  test('test_convertTranscriptionToScore_when_note_onsets_are_over_one_hundred_milliseconds_apart_then_preserves_two_attacks', () => {
    // Arrange
    const input = buildInput([
      { midi: 67, startSeconds: 0, endSeconds: 0.1, velocity: 80 },
      { midi: 72, startSeconds: 0.11, endSeconds: 0.3, velocity: 76 },
    ])

    // Act
    const result = convertTranscriptionToScore(input)

    // Assert
    expect(getVoiceEvents(result.measures[0], 'treble').slice(0, 2)).toEqual([
      { startBeat: 1, durationBeats: 0.25, notes: [{ pitch: 'G4' }] },
      { startBeat: 1.25, durationBeats: 0.25, notes: [{ pitch: 'C5' }] },
    ])
  })

  test('test_convertTranscriptionToScore_when_four_attacks_fit_one_beat_then_keeps_sixteenth_note_positions', () => {
    // Arrange
    const input = buildInput([
      { midi: 67, startSeconds: 0, endSeconds: 0.11, velocity: 80 },
      { midi: 69, startSeconds: 0.12, endSeconds: 0.23, velocity: 78 },
      { midi: 71, startSeconds: 0.24, endSeconds: 0.35, velocity: 76 },
      { midi: 72, startSeconds: 0.36, endSeconds: 0.47, velocity: 74 },
    ])

    // Act
    const result = convertTranscriptionToScore(input)

    // Assert
    expect(getVoiceEvents(result.measures[0], 'treble').slice(0, 4)).toEqual([
      { startBeat: 1, durationBeats: 0.25, notes: [{ pitch: 'G4' }] },
      { startBeat: 1.25, durationBeats: 0.25, notes: [{ pitch: 'A4' }] },
      { startBeat: 1.5, durationBeats: 0.25, notes: [{ pitch: 'B4' }] },
      { startBeat: 1.75, durationBeats: 0.25, notes: [{ pitch: 'C5' }] },
    ])
  })

  test('test_convertTranscriptionToScore_when_chord_notes_share_duration_then_builds_one_staff_voice_event', () => {
    // Arrange
    const input = buildInput([
      { midi: 67, startSeconds: 0, endSeconds: 0.5, velocity: 80 },
      { midi: 72, startSeconds: 0, endSeconds: 0.5, velocity: 76 },
      { midi: 76, startSeconds: 0, endSeconds: 0.5, velocity: 72 },
    ])

    // Act
    const result = convertTranscriptionToScore(input)

    // Assert
    const treble = result.measures[0]?.staves.find(staff => staff.clef === 'treble')
    expect(treble?.voices).toHaveLength(1)
    expect(treble?.voices[0]?.events[0]).toMatchObject({
      startBeat: 1,
      durationBeats: 1,
      notes: [{ pitch: 'G4' }, { pitch: 'C5' }, { pitch: 'E5' }],
    })
  })

  test('test_simplifyTiedEvents_when_identical_chord_is_one_plus_half_beats_then_uses_one_dotted_event', () => {
    // Arrange
    const events: ScoreEvent[] = [
      {
        startBeat: 1,
        durationBeats: 1,
        notes: [
          { pitch: 'C4', tieToNext: true },
          { pitch: 'E4', tieToNext: true },
          { pitch: 'G4', tieToNext: true },
        ],
      },
      {
        startBeat: 2,
        durationBeats: 0.5,
        notes: [
          { pitch: 'C4', tieFromPrevious: true },
          { pitch: 'E4', tieFromPrevious: true },
          { pitch: 'G4', tieFromPrevious: true },
        ],
      },
      { startBeat: 2.5, durationBeats: 2.5, notes: [] },
    ]

    // Act
    const result = simplifyTiedEvents(events)

    // Assert
    expect(result).toEqual([
      {
        startBeat: 1,
        durationBeats: 1.5,
        notes: [{ pitch: 'C4' }, { pitch: 'E4' }, { pitch: 'G4' }],
      },
      { startBeat: 2.5, durationBeats: 2.5, notes: [] },
    ])
  })

  test('test_simplifyTiedEvents_when_tie_crosses_middle_of_measure_then_keeps_readable_beat_boundary', () => {
    // Arrange
    const events: ScoreEvent[] = [
      {
        startBeat: 2,
        durationBeats: 1,
        notes: [{ pitch: 'C4', tieToNext: true }],
      },
      {
        startBeat: 3,
        durationBeats: 0.5,
        notes: [{ pitch: 'C4', tieFromPrevious: true }],
      },
      { startBeat: 3.5, durationBeats: 1.5, notes: [] },
    ]

    // Act
    const result = simplifyTiedEvents(events)

    // Assert
    expect(result).toEqual(events)
  })

  test('test_convertTranscriptionToScore_when_pedaled_chord_releases_are_staggered_then_uses_one_common_notated_duration', () => {
    // Arrange
    const input = {
      ...buildInput([
        { midi: 67, startSeconds: 0, endSeconds: 0.16, velocity: 49 },
        { midi: 72, startSeconds: 0, endSeconds: 0.49, velocity: 56 },
        { midi: 74, startSeconds: 0, endSeconds: 0.49, velocity: 54 },
        { midi: 79, startSeconds: 0, endSeconds: 0.56, velocity: 61 },
        { midi: 67, startSeconds: 1, endSeconds: 1.45, velocity: 53 },
        { midi: 72, startSeconds: 1, endSeconds: 1.96, velocity: 53 },
        { midi: 74, startSeconds: 1, endSeconds: 1.28, velocity: 54 },
        { midi: 79, startSeconds: 1, endSeconds: 1.45, velocity: 61 },
      ]),
      pedalEvents: [
        { timeSeconds: 0, value: 127 },
        { timeSeconds: 2, value: 0 },
      ],
    }

    // Act
    const result = convertTranscriptionToScore(input)

    // Assert
    expect(getVoiceEvents(result.measures[0], 'treble')).toEqual([
      {
        startBeat: 1,
        durationBeats: 1,
        notes: [
          { pitch: 'G4' },
          { pitch: 'C5' },
          { pitch: 'D5' },
          { pitch: 'G5' },
        ],
      },
      { startBeat: 2, durationBeats: 1, notes: [] },
      {
        startBeat: 3,
        durationBeats: 1,
        notes: [
          { pitch: 'G4' },
          { pitch: 'C5' },
          { pitch: 'D5' },
          { pitch: 'G5' },
        ],
      },
      { startBeat: 4, durationBeats: 1, notes: [] },
    ])
  })

  test('test_convertTranscriptionToScore_when_one_chord_attack_has_staggered_releases_then_keeps_one_notated_attack', () => {
    // Arrange
    const input = buildInput([
      { midi: 67, startSeconds: 0, endSeconds: 0.48, velocity: 70 },
      { midi: 72, startSeconds: 0.01, endSeconds: 0.72, velocity: 72 },
      { midi: 76, startSeconds: 0.02, endSeconds: 0.96, velocity: 74 },
    ])

    // Act
    const result = convertTranscriptionToScore(input)

    // Assert
    expect(getVoiceEvents(result.measures[0], 'treble').filter(event => event.notes.length > 0))
      .toEqual([{
        startBeat: 1,
        durationBeats: 1.5,
        notes: [{ pitch: 'G4' }, { pitch: 'C5' }, { pitch: 'E5' }],
      }])
  })

  test('test_convertTranscriptionToScore_when_chord_release_quantizes_to_one_and_quarter_beats_then_uses_one_readable_attack', () => {
    // Arrange
    const input = {
      ...buildInput([
        { midi: 67, startSeconds: 0, endSeconds: 0.62, velocity: 70 },
        { midi: 72, startSeconds: 0, endSeconds: 0.62, velocity: 72 },
        { midi: 76, startSeconds: 0, endSeconds: 0.62, velocity: 74 },
      ]),
      pedalEvents: [
        { timeSeconds: 0, value: 127 },
        { timeSeconds: 1, value: 0 },
      ],
    }

    // Act
    const result = convertTranscriptionToScore(input)

    // Assert
    expect(getVoiceEvents(result.measures[0], 'treble').filter(event => event.notes.length > 0))
      .toEqual([{
        startBeat: 1,
        durationBeats: 1,
        notes: [{ pitch: 'G4' }, { pitch: 'C5' }, { pitch: 'E5' }],
      }])
  })

  test('test_convertTranscriptionToScore_when_chord_note_crosses_later_attack_then_ends_chord_before_new_attack', () => {
    // Arrange
    const input = {
      ...buildInput([
        { midi: 67, startSeconds: 0, endSeconds: 0.5, velocity: 70 },
        { midi: 71, startSeconds: 0, endSeconds: 0.5, velocity: 72 },
        { midi: 76, startSeconds: 0, endSeconds: 1.5, velocity: 80 },
        { midi: 77, startSeconds: 0.5, endSeconds: 1, velocity: 76 },
      ]),
      pedalEvents: [
        { timeSeconds: 0, value: 127 },
        { timeSeconds: 2, value: 0 },
      ],
    }

    // Act
    const result = convertTranscriptionToScore(input)

    // Assert
    expect(getVoiceEvents(result.measures[0], 'treble').slice(0, 3)).toEqual([
      {
        startBeat: 1,
        durationBeats: 1,
        notes: [
          { pitch: 'G4' },
          { pitch: 'B4' },
          { pitch: 'E5' },
        ],
      },
      {
        startBeat: 2,
        durationBeats: 1,
        notes: [{ pitch: 'F5' }],
      },
      { startBeat: 3, durationBeats: 2, notes: [] },
    ])
  })

  test('test_convertTranscriptionToScore_when_resonant_note_crosses_later_attacks_then_keeps_one_readable_voice', () => {
    // Arrange
    const input = buildInput([
      { midi: 72, startSeconds: 0, endSeconds: 1.5, velocity: 80 },
      { midi: 77, startSeconds: 0.5, endSeconds: 1, velocity: 74 },
      { midi: 79, startSeconds: 1, endSeconds: 1.5, velocity: 72 },
      { midi: 81, startSeconds: 1.5, endSeconds: 2, velocity: 70 },
    ])

    // Act
    const result = convertTranscriptionToScore(input)

    // Assert
    const treble = result.measures[0]?.staves.find(staff => staff.clef === 'treble')
    expect(treble?.voices).toHaveLength(1)
    expect(treble?.voices[0]?.events.filter(event => event.notes.length > 0)).toEqual([
      {
        startBeat: 1,
        durationBeats: 1,
        notes: [{ pitch: 'C5' }],
      },
      {
        startBeat: 2,
        durationBeats: 1,
        notes: [{ pitch: 'F5' }],
      },
      {
        startBeat: 3,
        durationBeats: 1,
        notes: [{ pitch: 'G5' }],
      },
      {
        startBeat: 4,
        durationBeats: 1,
        notes: [{ pitch: 'A5' }],
      },
    ])
  })

  test('test_convertTranscriptionToScore_when_resonant_note_overlaps_chord_then_keeps_one_readable_voice', () => {
    // Arrange
    const input = buildInput([
      { midi: 84, startSeconds: 0, endSeconds: 1.5, velocity: 80 },
      { midi: 76, startSeconds: 0.5, endSeconds: 1, velocity: 76 },
      { midi: 83, startSeconds: 0.5, endSeconds: 1, velocity: 72 },
    ])

    // Act
    const result = convertTranscriptionToScore(input)

    // Assert
    const treble = result.measures[0]?.staves.find(staff => staff.clef === 'treble')
    expect(treble?.voices).toHaveLength(1)
    expect(treble?.voices[0]?.events.filter(event => event.notes.length > 0)).toEqual([
      {
        startBeat: 1,
        durationBeats: 1,
        notes: [{ pitch: 'C6' }],
      },
      {
        startBeat: 2,
        durationBeats: 1,
        notes: [{ pitch: 'E5' }, { pitch: 'B5' }],
      },
    ])
  })

  test('test_convertTranscriptionToScore_when_notes_span_middle_c_then_separates_staves', () => {
    // Arrange
    const input = buildInput([
      { midi: 60, startSeconds: 0, endSeconds: 0.5, velocity: 80 },
      { midi: 84, startSeconds: 0, endSeconds: 0.5, velocity: 80 },
    ])

    // Act
    const result = convertTranscriptionToScore(input)

    // Assert
    expect(getSoundingPitches(result.measures[0], 'bass')).toEqual(['C4'])
    expect(getSoundingPitches(result.measures[0], 'treble')).toEqual(['C6'])
  })

  test('test_convertTranscriptionToScore_when_notes_cross_middle_c_then_keeps_each_staff_playable', () => {
    // Arrange
    const input = buildInput([
      { midi: 41, startSeconds: 0, endSeconds: 0.5, velocity: 80 },
      { midi: 53, startSeconds: 0, endSeconds: 0.5, velocity: 80 },
      { midi: 72, startSeconds: 0, endSeconds: 0.5, velocity: 80 },
    ])

    // Act
    const result = convertTranscriptionToScore(input)

    // Assert
    expect(getSoundingPitches(result.measures[0], 'bass')).toEqual(['F2', 'F3'])
    expect(getSoundingPitches(result.measures[0], 'treble')).toEqual(['C5'])
  })

  test('test_convertTranscriptionToScore_when_low_notes_exceed_hand_span_then_splits_them_between_staves', () => {
    // Arrange
    const input = buildInput([
      { midi: 41, startSeconds: 0, endSeconds: 0.5, velocity: 80 },
      { midi: 57, startSeconds: 0, endSeconds: 0.5, velocity: 80 },
    ])

    // Act
    const result = convertTranscriptionToScore(input)

    // Assert
    expect(getSoundingPitches(result.measures[0], 'bass')).toEqual(['F2'])
    expect(getSoundingPitches(result.measures[0], 'treble')).toEqual(['A3'])
  })

  test('test_convertTranscriptionToScore_when_sustained_bass_overlaps_upper_notes_then_keeps_both_staff_spans_playable', () => {
    // Arrange
    const input = buildInput([
      { midi: 41, startSeconds: 0, endSeconds: 1.5, velocity: 80 },
      { midi: 57, startSeconds: 0.5, endSeconds: 1, velocity: 80 },
      { midi: 60, startSeconds: 0.5, endSeconds: 1, velocity: 80 },
    ])

    // Act
    const result = convertTranscriptionToScore(input)

    // Assert
    expect(getSoundingPitches(result.measures[0], 'bass')).toEqual(['F2'])
    expect(getSoundingPitches(result.measures[0], 'treble')).toEqual(['A3', 'C4'])
  })

  test('test_convertTranscriptionToScore_when_later_bass_overlaps_sustained_upper_note_then_reassigns_the_upper_note', () => {
    // Arrange
    const input = buildInput([
      { midi: 58, startSeconds: 0, endSeconds: 1.5, velocity: 80 },
      { midi: 43, startSeconds: 0.5, endSeconds: 1, velocity: 80 },
    ])

    // Act
    const result = convertTranscriptionToScore(input)

    // Assert
    expect(getSoundingPitches(result.measures[0], 'bass')).toEqual(['G2'])
    expect(getSoundingPitches(result.measures[0], 'treble')).toEqual(['A#3'])
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
    expect(getSoundingPitches(result.measures[0], 'bass')).toEqual(['C3'])
    expect(getSoundingPitches(result.measures[0], 'treble')).toEqual(['C5'])
  })

  test('test_convertTranscriptionToScore_when_note_crosses_measure_then_marks_notation_segments_tied', () => {
    // Arrange
    const input = buildInput([
      { midi: 72, startSeconds: 1.75, endSeconds: 2.25, velocity: 80 },
    ], 2.5)

    // Act
    const result = convertTranscriptionToScore(input)

    // Assert
    expect(result.measures).toHaveLength(2)
    expect(getVoiceEvents(result.measures[0], 'treble').at(-1)).toMatchObject({
      startBeat: 4.5,
      durationBeats: 0.5,
      notes: [{ pitch: 'C5', tieToNext: true }],
    })
    expect(getVoiceEvents(result.measures[1], 'treble')[0]).toMatchObject({
      startBeat: 1,
      durationBeats: 0.5,
      notes: [{ pitch: 'C5', tieFromPrevious: true }],
    })
  })

  test('test_convertTranscriptionToScore_when_score_is_built_then_each_voice_fills_every_measure', () => {
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
      for (const staff of measure.staves) {
        for (const voice of staff.voices) {
          expect(sumDurations(voice.events)).toBe(4)
        }
      }
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
    expect(getVoiceEvents(result.measures[0], 'bass')[0]).toMatchObject({
      startBeat: 1,
      notes: [{ pitch: 'C4' }],
    })
  })

  test('test_convertTranscriptionToScore_when_detected_beats_drift_then_places_late_piano_entry_on_matching_beat', () => {
    // Arrange
    const input = {
      ...buildInput([
        { midi: 60, startSeconds: 2.72, endSeconds: 3.1, velocity: 80 },
      ], 5, 1),
      beatSeconds: [1, 1.8, 2.7, 3.5, 4.4],
    }

    // Act
    const result = convertTranscriptionToScore(input)

    // Assert
    expect(getVoiceEvents(result.measures[0], 'bass').slice(0, 2)).toEqual([
      expect.objectContaining({ startBeat: 1, durationBeats: 2, notes: [] }),
      expect.objectContaining({ startBeat: 3, durationBeats: 0.5, notes: [{ pitch: 'C4' }] }),
    ])
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
    expect(getSoundingPitches(result.measures[2], 'treble')).toContain('E4')
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

  test('test_convertTranscriptionToScore_when_detected_beats_drift_then_aligns_pedal_to_actual_beats', () => {
    // Arrange
    const input = {
      ...buildInput([
        { midi: 60, startSeconds: 1.8, endSeconds: 2.7, velocity: 80 },
      ], 5, 1),
      beatSeconds: [1, 1.8, 2.7, 3.5, 4.4],
      pedalEvents: [
        { timeSeconds: 1.8, value: 127 },
        { timeSeconds: 2.7, value: 0 },
      ],
    }

    // Act
    const result = convertTranscriptionToScore(input)

    // Assert
    expect(result.pedalIntervals).toEqual([{
      startBeatOffset: 1,
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
    const pitches = result.measures.flatMap(measure => measure.staves.flatMap(staff =>
      staff.voices.flatMap(voice => voice.events.flatMap(event => event.notes.map(note => note.pitch)))))
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

function getStaff(
  measure: ReturnType<typeof convertTranscriptionToScore>['measures'][number] | undefined,
  clef: 'treble' | 'bass',
) {
  const staff = measure?.staves.find(candidate => candidate.clef === clef)
  if (!staff) {
    throw new Error(`Missing ${clef} staff`)
  }
  return staff
}

function getVoiceEvents(
  measure: ReturnType<typeof convertTranscriptionToScore>['measures'][number] | undefined,
  clef: 'treble' | 'bass',
) {
  return getStaff(measure, clef).voices[0]!.events
}

function getSoundingPitches(
  measure: ReturnType<typeof convertTranscriptionToScore>['measures'][number] | undefined,
  clef: 'treble' | 'bass',
): string[] {
  return getStaff(measure, clef).voices.flatMap(voice =>
    voice.events.flatMap(event => event.notes.map(note => note.pitch)))
}
