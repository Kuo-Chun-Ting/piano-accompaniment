import { describe, expect, test } from 'vitest'
import {
  inferSustainPedalEvents,
  mergePedalEvents,
} from '../../../shared/audio-transcription/sustainInference'
import type { PitchEnergySamples } from '../../../shared/audio-transcription/onsetEvidence'
import type { TranscribedNote } from '../../../shared/audio-transcription/types'

const FRAME_SECONDS = 0.01
const NOISE_FLOOR = 0.01

describe('sustainInference', () => {
  test('test_inferSustainPedalEvents_when_chord_keeps_sounding_across_next_attack_then_adds_pedal_interval', () => {
    // Arrange
    const notes = [
      note(48, 0.2, 1.4),
      note(55, 0.202, 1.35),
      note(60, 0.204, 0.8),
      note(64, 1, 1.3),
    ]

    // Act
    const result = inferSustainPedalEvents(notes, {
      noiseFloor: NOISE_FLOOR,
      pitches: [soundingSamples(48), soundingSamples(55), soundingSamples(60), soundingSamples(64)],
    })

    // Assert
    expect(result).toEqual([
      { timeSeconds: 0.2, value: 127 },
      { timeSeconds: 1.4, value: 0 },
    ])
  })

  test('test_inferSustainPedalEvents_when_pitch_energy_has_died_before_next_attack_then_does_not_add_pedal', () => {
    // Arrange
    const notes = [
      note(48, 0.2, 1.4),
      note(55, 0.202, 1.35),
      note(64, 1, 1.3),
    ]

    // Act
    const result = inferSustainPedalEvents(notes, {
      noiseFloor: NOISE_FLOOR,
      pitches: [silentAfterSamples(48, 0.8), silentAfterSamples(55, 0.8), soundingSamples(64)],
    })

    // Assert
    expect(result).toEqual([])
  })

  test('test_inferSustainPedalEvents_when_only_one_note_crosses_next_attack_then_does_not_guess_pedal', () => {
    // Arrange
    const notes = [
      note(48, 0.2, 1.4),
      note(64, 1, 1.3),
    ]

    // Act
    const result = inferSustainPedalEvents(notes, {
      noiseFloor: NOISE_FLOOR,
      pitches: [soundingSamples(48), soundingSamples(64)],
    })

    // Assert
    expect(result).toEqual([])
  })

  test('test_inferSustainPedalEvents_when_next_chord_starts_before_resonance_ends_then_refreshes_pedal_at_chord', () => {
    // Arrange
    const notes = [
      note(48, 0.2, 1.8),
      note(55, 0.202, 1.7),
      note(64, 1, 1.3),
      note(67, 1.002, 1.4),
    ]

    // Act
    const result = inferSustainPedalEvents(notes, {
      noiseFloor: NOISE_FLOOR,
      pitches: [soundingSamples(48), soundingSamples(55), soundingSamples(64), soundingSamples(67)],
    })

    // Assert
    expect(result).toEqual([
      { timeSeconds: 0.2, value: 127 },
      { timeSeconds: 1, value: 0 },
    ])
  })

  test('test_mergePedalEvents_when_detected_and_inferred_intervals_overlap_then_returns_one_interval', () => {
    // Arrange
    const detected = [
      { timeSeconds: 1, value: 127 },
      { timeSeconds: 2, value: 0 },
    ]
    const inferred = [
      { timeSeconds: 1.8, value: 127 },
      { timeSeconds: 3, value: 0 },
    ]

    // Act
    const result = mergePedalEvents(detected, inferred)

    // Assert
    expect(result).toEqual([
      { timeSeconds: 1, value: 127 },
      { timeSeconds: 2, value: 0 },
      { timeSeconds: 2, value: 127 },
      { timeSeconds: 3, value: 0 },
    ])
  })
})

function note(midi: number, startSeconds: number, endSeconds: number): TranscribedNote {
  return { midi, startSeconds, endSeconds, velocity: 64 }
}

function soundingSamples(midi: number): PitchEnergySamples {
  return {
    midi,
    startSeconds: 0,
    frameSeconds: FRAME_SECONDS,
    values: Array.from({ length: 200 }, (_, index) => index < 20 ? 0 : 0.5),
  }
}

function silentAfterSamples(midi: number, endSeconds: number): PitchEnergySamples {
  return {
    ...soundingSamples(midi),
    values: Array.from({ length: 200 }, (_, index) =>
      index * FRAME_SECONDS < endSeconds ? 0.5 : 0),
  }
}
