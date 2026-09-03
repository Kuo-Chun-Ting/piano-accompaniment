import { describe, expect, test } from 'vitest'
import {
  cleanTranscribedNotes,
  parsePitchEnergyFile,
} from '../../../shared/audio-transcription/onsetCleaning'
import type { PitchEnergySamples } from '../../../shared/audio-transcription/onsetEvidence'
import type { TranscribedNote } from '../../../shared/audio-transcription/types'

const FRAME_SECONDS = 0.01
const NOISE_FLOOR = 0.01

describe('onsetCleaning', () => {
  test('test_cleanTranscribedNotes_when_repeated_chord_has_no_new_attack_then_merges_into_previous_notes', () => {
    // Arrange
    const notes = [
      note(60, 0.2, 0.8),
      note(64, 0.202, 0.82),
      note(60, 1, 1.3),
      note(64, 1.002, 1.4),
    ]

    // Act
    const result = cleanTranscribedNotes(notes, energyFile([
      decaySamples(60),
      decaySamples(64),
    ]))

    // Assert
    expect(result.notes).toEqual([
      note(60, 0.2, 1.3),
      note(64, 0.202, 1.4),
    ])
    expect(result.rejectedGroups).toHaveLength(1)
  })

  test('test_cleanTranscribedNotes_when_rejected_groups_are_consecutive_then_keeps_original_anchor', () => {
    // Arrange
    const notes = [
      note(60, 0.2, 0.8),
      note(64, 0.202, 0.82),
      note(60, 1, 1.1),
      note(64, 1.002, 1.1),
      note(60, 1.15, 1.4),
      note(64, 1.152, 1.45),
    ]

    // Act
    const result = cleanTranscribedNotes(notes, energyFile([
      decaySamples(60),
      decaySamples(64),
    ]))

    // Assert
    expect(result.notes).toEqual([
      note(60, 0.2, 1.4),
      note(64, 0.202, 1.45),
    ])
    expect(result.rejectedGroups).toHaveLength(2)
  })

  test('test_cleanTranscribedNotes_when_one_chord_pitch_has_new_attack_then_keeps_whole_group', () => {
    // Arrange
    const notes = [
      note(60, 0.2, 0.8),
      note(64, 0.202, 0.82),
      note(60, 1, 1.3),
      note(64, 1.002, 1.4),
    ]

    // Act
    const result = cleanTranscribedNotes(notes, energyFile([
      strikeSamples(decaySamples(60), 1, 3),
      decaySamples(64),
    ]))

    // Assert
    expect(result.notes).toEqual(notes)
    expect(result.rejectedGroups).toHaveLength(0)
  })

  test('test_cleanTranscribedNotes_when_single_pitch_lacks_attack_evidence_then_preserves_note', () => {
    // Arrange
    const notes = [note(60, 0.2, 0.8), note(60, 1, 1.3)]

    // Act
    const result = cleanTranscribedNotes(notes, energyFile([decaySamples(60)]))

    // Assert
    expect(result.notes).toEqual(notes)
    expect(result.rejectedGroups).toHaveLength(0)
  })

  test('test_cleanTranscribedNotes_when_repeated_group_is_subset_of_sounding_chord_then_merges_only_repeated_pitches', () => {
    // Arrange
    const notes = [
      note(43, 0.2, 1.8),
      note(53, 0.202, 0.9),
      note(57, 0.204, 0.8),
      note(60, 0.206, 0.82),
      note(57, 1, 1.3),
      note(60, 1.002, 1.4),
    ]

    // Act
    const result = cleanTranscribedNotes(notes, energyFile([
      decaySamples(57),
      decaySamples(60),
    ]))

    // Assert
    expect(result.notes).toEqual([
      note(43, 0.2, 1.8),
      note(53, 0.202, 0.9),
      note(57, 0.204, 1.3),
      note(60, 0.206, 1.4),
    ])
    expect(result.rejectedGroups).toEqual([{ startSeconds: 1, pitches: [57, 60] }])
  })

  test('test_cleanTranscribedNotes_when_harmonic_like_rise_confirms_one_pitch_then_preserves_group', () => {
    // Arrange
    const notes = [
      note(48, 0.2, 1.5),
      note(60, 0.202, 0.8),
      note(48, 1, 1.3),
      note(60, 1.002, 1.4),
    ]

    // Act
    const result = cleanTranscribedNotes(notes, energyFile([
      decaySamples(48),
      strikeSamples(decaySamples(60), 1, 3),
    ]))

    // Assert
    expect(result.notes).toEqual(notes)
    expect(result.rejectedGroups).toHaveLength(0)
  })

  test('test_parsePitchEnergyFile_when_export_is_valid_then_attaches_shared_timing_to_each_pitch', () => {
    // Arrange
    const exported = {
      noiseFloor: 0.01,
      startSeconds: 0.25,
      frameSeconds: 0.02,
      pitches: [
        { midi: 60, values: [0.1, 0.2] },
        { midi: 64, values: [0.3, 0.4] },
      ],
    }

    // Act
    const result = parsePitchEnergyFile(exported)

    // Assert
    expect(result).toEqual({
      noiseFloor: 0.01,
      pitches: [
        { midi: 60, startSeconds: 0.25, frameSeconds: 0.02, values: [0.1, 0.2] },
        { midi: 64, startSeconds: 0.25, frameSeconds: 0.02, values: [0.3, 0.4] },
      ],
    })
  })

  test('test_parsePitchEnergyFile_when_export_contains_invalid_values_then_throws', () => {
    // Arrange
    const exported = {
      noiseFloor: 0.01,
      startSeconds: 0,
      frameSeconds: 0.02,
      pitches: [{ midi: 60, values: [0.1, Number.NaN] }],
    }

    // Act / Assert
    expect(() => parsePitchEnergyFile(exported)).toThrow('Pitch-energy export is invalid')
  })
})

function note(
  midi: number,
  startSeconds: number,
  endSeconds: number,
): TranscribedNote {
  return { midi, startSeconds, endSeconds, velocity: 64 }
}

function energyFile(pitches: PitchEnergySamples[]) {
  return { noiseFloor: NOISE_FLOOR, pitches }
}

function decaySamples(midi: number): PitchEnergySamples {
  const values = Array.from({ length: 180 }, (_, index) => {
    const seconds = index * FRAME_SECONDS
    if (seconds < 0.2) {
      return NOISE_FLOOR / 10
    }

    const decayed = 2 ** (-(seconds - 0.2) / 0.8)
    return decayed * (index % 2 === 0 ? 1.02 : 0.98)
  })
  return { midi, startSeconds: 0, frameSeconds: FRAME_SECONDS, values }
}

function strikeSamples(
  samples: PitchEnergySamples,
  atSeconds: number,
  gain: number,
): PitchEnergySamples {
  return {
    ...samples,
    values: samples.values.map((value, index) =>
      index * samples.frameSeconds >= atSeconds ? value * gain : value),
  }
}
