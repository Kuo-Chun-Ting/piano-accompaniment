import { describe, expect, test } from 'vitest'
import {
  evaluateOnsetEvidence,
  type PitchEnergySamples,
} from '../../../shared/audio-transcription/onsetEvidence'

const FRAME_SECONDS = 0.01
const NOISE_FLOOR = 0.01

describe('onsetEvidence', () => {
  test('test_evaluateOnsetEvidence_when_pitch_only_decays_then_rejects_candidate', () => {
    // Arrange
    const samples = buildDecaySamples({ startSeconds: 12, durationSeconds: 1 })

    // Act
    const evidence = evaluateOnsetEvidence({
      samples,
      candidateSeconds: 12.8,
      previousOnsetSeconds: 12,
      noiseFloor: NOISE_FLOOR,
    })

    // Assert
    expect(evidence.status).toBe('rejected')
  })

  test('test_evaluateOnsetEvidence_when_pitch_is_struck_again_then_confirms_candidate', () => {
    // Arrange
    const samples = applyStrike(
      buildDecaySamples({ startSeconds: 12, durationSeconds: 1 }),
      { atSeconds: 12.8, gain: 3 },
    )

    // Act
    const evidence = evaluateOnsetEvidence({
      samples,
      candidateSeconds: 12.8,
      previousOnsetSeconds: 12,
      noiseFloor: NOISE_FLOOR,
    })

    // Assert
    expect(evidence.status).toBe('confirmed')
  })

  test('test_evaluateOnsetEvidence_when_rise_is_close_to_local_fluctuation_then_reports_uncertain', () => {
    // Arrange
    const samples = applyStrike(
      buildDecaySamples({ startSeconds: 12, durationSeconds: 1 }),
      { atSeconds: 12.8, gain: 1.1 },
    )

    // Act
    const evidence = evaluateOnsetEvidence({
      samples,
      candidateSeconds: 12.8,
      previousOnsetSeconds: 12,
      noiseFloor: NOISE_FLOOR,
    })

    // Assert
    expect(evidence.status).toBe('uncertain')
  })

  test('test_evaluateOnsetEvidence_when_baseline_excludes_previous_attack_then_confirms_fast_restrike', () => {
    // Arrange
    const samples = applyStrike(
      buildDecaySamples({ startSeconds: 11.8, durationSeconds: 1.2, silentUntilSeconds: 12 }),
      { atSeconds: 12.4, gain: 3 },
    )

    // Act
    const evidence = evaluateOnsetEvidence({
      samples,
      candidateSeconds: 12.4,
      previousOnsetSeconds: 12,
      noiseFloor: NOISE_FLOOR,
    })

    // Assert
    expect(evidence.baselineStartSeconds).toBeGreaterThanOrEqual(12)
    expect(evidence.status).toBe('confirmed')
  })

  test('test_evaluateOnsetEvidence_when_baseline_window_is_too_short_then_reports_uncertain', () => {
    // Arrange
    const samples = buildDecaySamples({ startSeconds: 12, durationSeconds: 1 })

    // Act
    const evidence = evaluateOnsetEvidence({
      samples,
      candidateSeconds: 12.15,
      previousOnsetSeconds: 12,
      noiseFloor: NOISE_FLOOR,
    })

    // Assert
    expect(evidence.status).toBe('uncertain')
  })

  test('test_evaluateOnsetEvidence_when_pitch_is_below_noise_floor_then_confirms_candidate', () => {
    // Arrange
    const samples = buildDecaySamples({
      startSeconds: 12,
      durationSeconds: 1,
      initialLevel: NOISE_FLOOR / 10,
    })

    // Act
    const evidence = evaluateOnsetEvidence({
      samples,
      candidateSeconds: 12.8,
      previousOnsetSeconds: 12,
      noiseFloor: NOISE_FLOOR,
    })

    // Assert
    expect(evidence.status).toBe('confirmed')
  })

  test('test_evaluateOnsetEvidence_when_energy_is_ambiguous_but_window_has_no_fast_rise_then_rejects_candidate', () => {
    // Arrange
    const samples = buildPlateauSamples({ driftAtSeconds: 12.55, driftGain: 1.35 })

    // Act
    const evidence = evaluateOnsetEvidence({
      samples,
      candidateSeconds: 12.8,
      previousOnsetSeconds: 12,
      noiseFloor: NOISE_FLOOR,
    })

    // Assert
    expect(evidence.attackRise).toBeLessThan(0.05)
    expect(evidence.status).toBe('rejected')
  })

  test('test_evaluateOnsetEvidence_when_energy_is_ambiguous_but_window_has_fast_rise_then_confirms_candidate', () => {
    // Arrange
    const samples = applyStrike(
      buildPlateauSamples({ driftAtSeconds: 12.55, driftGain: 1.35 }),
      { atSeconds: 12.8, gain: 1.35 },
    )

    // Act
    const evidence = evaluateOnsetEvidence({
      samples,
      candidateSeconds: 12.8,
      previousOnsetSeconds: 12,
      noiseFloor: NOISE_FLOOR,
    })

    // Assert
    expect(evidence.attackRise).toBeGreaterThan(0.2)
    expect(evidence.status).toBe('confirmed')
  })

  test('test_evaluateOnsetEvidence_when_candidate_is_evaluated_then_reports_traceable_measurements', () => {
    // Arrange
    const samples = buildDecaySamples({ startSeconds: 12, durationSeconds: 1 })

    // Act
    const evidence = evaluateOnsetEvidence({
      samples,
      candidateSeconds: 12.8,
      previousOnsetSeconds: 12,
      noiseFloor: NOISE_FLOOR,
    })

    // Assert
    expect(evidence.baselineEndSeconds).toBeGreaterThan(evidence.baselineStartSeconds)
    expect(evidence.baselineFrameCount).toBeGreaterThan(0)
    expect(evidence.predictedLevel).toBeGreaterThan(0)
    expect(evidence.dispersion).toBeGreaterThan(0)
    expect(Number.isFinite(evidence.score)).toBe(true)
    expect(Number.isFinite(evidence.attackRise)).toBe(true)
    expect(Number.isFinite(evidence.attackSlope)).toBe(true)
  })
})

type DecayOptions = {
  startSeconds: number
  durationSeconds: number
  initialLevel?: number
  halfLifeSeconds?: number
  silentUntilSeconds?: number
}

function buildDecaySamples(options: DecayOptions): PitchEnergySamples {
  const initialLevel = options.initialLevel ?? 1
  const halfLifeSeconds = options.halfLifeSeconds ?? 0.8
  const silentUntilSeconds = options.silentUntilSeconds ?? options.startSeconds
  const frameCount = Math.round(options.durationSeconds / FRAME_SECONDS)
  const values = Array.from({ length: frameCount }, (_, index) => {
    const seconds = options.startSeconds + index * FRAME_SECONDS
    if (seconds < silentUntilSeconds) {
      return initialLevel / 1000
    }

    const decayed = initialLevel * 2 ** (-(seconds - silentUntilSeconds) / halfLifeSeconds)
    return decayed * (index % 2 === 0 ? 1.02 : 0.98)
  })

  return { midi: 60, startSeconds: options.startSeconds, frameSeconds: FRAME_SECONDS, values }
}

function applyStrike(
  samples: PitchEnergySamples,
  strike: { atSeconds: number, gain: number },
): PitchEnergySamples {
  const values = samples.values.map((value, index) => {
    const seconds = samples.startSeconds + index * samples.frameSeconds
    return seconds >= strike.atSeconds ? value * strike.gain : value
  })

  return { ...samples, values }
}

function buildPlateauSamples(
  drift: { driftAtSeconds: number, driftGain: number },
): PitchEnergySamples {
  const samples = buildDecaySamples({ startSeconds: 12, durationSeconds: 1 })
  const values = samples.values.map((value, index) => {
    const seconds = samples.startSeconds + index * samples.frameSeconds
    return seconds >= drift.driftAtSeconds ? value * drift.driftGain : value
  })

  return { ...samples, values }
}
