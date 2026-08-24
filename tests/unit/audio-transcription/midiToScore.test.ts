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

  test('test_convertTranscriptionToScore_when_simultaneous_notes_have_different_durations_then_uses_partial_ties_in_one_voice', () => {
    // Arrange
    const input = buildInput([
      { midi: 67, startSeconds: 0, endSeconds: 2, velocity: 80 },
      { midi: 72, startSeconds: 0, endSeconds: 1, velocity: 76 },
      { midi: 76, startSeconds: 0, endSeconds: 0.5, velocity: 72 },
    ])

    // Act
    const result = convertTranscriptionToScore(input)

    // Assert
    const treble = result.measures[0]?.staves.find(staff => staff.clef === 'treble')
    expect(treble?.voices).toHaveLength(1)
    expect(treble?.voices[0]?.events).toEqual([
      expect.objectContaining({
        startBeat: 1,
        durationBeats: 1,
        notes: [
          { pitch: 'G4', tieToNext: true },
          { pitch: 'C5', tieToNext: true },
          { pitch: 'E5' },
        ],
      }),
      expect.objectContaining({
        startBeat: 2,
        durationBeats: 1,
        notes: [
          { pitch: 'G4', tieFromPrevious: true, tieToNext: true },
          { pitch: 'C5', tieFromPrevious: true },
        ],
      }),
      expect.objectContaining({
        startBeat: 3,
        durationBeats: 2,
        notes: [{ pitch: 'G4', tieFromPrevious: true }],
      }),
    ])
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
    expect(getVoiceEvents(result.measures[0], 'treble').filter(event => event.notes.length > 0)).toEqual([
      expect.objectContaining({
        startBeat: 1,
        durationBeats: 1,
        notes: [{ pitch: 'C6', tieToNext: true }],
      }),
      expect.objectContaining({
        startBeat: 2,
        durationBeats: 1,
        notes: [
          { pitch: 'E5' },
          { pitch: 'B5' },
          { pitch: 'C6', tieFromPrevious: true, tieToNext: true },
        ],
      }),
      expect.objectContaining({
        startBeat: 3,
        durationBeats: 1,
        notes: [{ pitch: 'C6', tieFromPrevious: true }],
      }),
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
    expect(getVoiceEvents(result.measures[0], 'bass')[1]?.notes.map(note => note.pitch))
      .toEqual(['F2'])
    expect(getVoiceEvents(result.measures[0], 'treble')[1]?.notes.map(note => note.pitch))
      .toEqual(['A3', 'C4'])
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
    expect(getVoiceEvents(result.measures[0], 'bass')[1]?.notes.map(note => note.pitch))
      .toEqual(['G2'])
    expect(getVoiceEvents(result.measures[0], 'treble')[1]?.notes.map(note => note.pitch))
      .toEqual(['A#3'])
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
