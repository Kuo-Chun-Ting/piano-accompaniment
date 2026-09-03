const ATTACK_SKIP_SECONDS = 0.12
const GUARD_SECONDS = 0.01
const PEAK_WINDOW_SECONDS = 0.09
const SOUNDING_WINDOW_SECONDS = 0.2
const MINIMUM_BASELINE_FRAMES = 8
const MINIMUM_DISPERSION = 0.05
const CONFIRMED_SCORE = 3
const REJECTED_SCORE = 1
const SHAPE_WINDOW_BEFORE_SECONDS = 0.03
const SHAPE_WINDOW_AFTER_SECONDS = 0.06
const NO_ATTACK_RISE = 0.05
const ATTACK_RISE = 0.2
const LEVEL_EPSILON = 1e-9

export type PitchEnergySamples = {
  midi: number
  startSeconds: number
  frameSeconds: number
  values: number[]
}

export type OnsetEvidenceInput = {
  samples: PitchEnergySamples
  candidateSeconds: number
  previousOnsetSeconds: number
  noiseFloor: number
}

export type OnsetEvidenceStatus = 'confirmed' | 'uncertain' | 'rejected'

export type OnsetEvidence = {
  status: OnsetEvidenceStatus
  baselineStartSeconds: number
  baselineEndSeconds: number
  baselineFrameCount: number
  soundingLevel: number
  predictedLevel: number
  observedLevel: number
  dispersion: number
  residual: number
  score: number
  attackRise: number
  attackSlope: number
}

export function evaluateOnsetEvidence(input: OnsetEvidenceInput): OnsetEvidence {
  const baselineStartSeconds = Math.max(
    input.samples.startSeconds,
    input.previousOnsetSeconds + ATTACK_SKIP_SECONDS,
  )
  const baselineEndSeconds = input.candidateSeconds - GUARD_SECONDS
  const baseline = collectFrames(input.samples, baselineStartSeconds, baselineEndSeconds)
  const soundingLevel = averageLevel(collectFrames(
    input.samples,
    input.candidateSeconds - SOUNDING_WINDOW_SECONDS,
    baselineEndSeconds,
  ))
  const observedLevel = peakLevel(collectFrames(
    input.samples,
    input.candidateSeconds - GUARD_SECONDS,
    input.candidateSeconds + PEAK_WINDOW_SECONDS,
  ))
  const shape = measureAttackShape(collectFrames(
    input.samples,
    input.candidateSeconds - SHAPE_WINDOW_BEFORE_SECONDS,
    input.candidateSeconds + SHAPE_WINDOW_AFTER_SECONDS,
  ), input.samples.frameSeconds)
  const report = {
    baselineStartSeconds,
    baselineEndSeconds,
    baselineFrameCount: baseline.length,
    soundingLevel,
    observedLevel,
    ...shape,
  }

  if (soundingLevel < input.noiseFloor) {
    return {
      ...report,
      status: 'confirmed',
      predictedLevel: soundingLevel,
      dispersion: MINIMUM_DISPERSION,
      residual: Number.NaN,
      score: Number.NaN,
    }
  }
  if (baseline.length < MINIMUM_BASELINE_FRAMES) {
    return {
      ...report,
      status: 'uncertain',
      predictedLevel: soundingLevel,
      dispersion: MINIMUM_DISPERSION,
      residual: Number.NaN,
      score: Number.NaN,
    }
  }

  const trend = fitLogTrend(baseline)
  const predictedLogLevel = trend.intercept + trend.slope * input.candidateSeconds
  const dispersion = Math.max(
    MINIMUM_DISPERSION,
    estimateDispersion(baseline, trend),
  )
  const residual = toLogLevel(observedLevel) - predictedLogLevel
  const score = residual / dispersion

  return {
    ...report,
    status: refineWithAttackShape(classifyScore(score), shape.attackRise),
    predictedLevel: Math.exp(predictedLogLevel),
    dispersion,
    residual,
    score,
  }
}

function refineWithAttackShape(
  status: OnsetEvidenceStatus,
  attackRise: number,
): OnsetEvidenceStatus {
  if (status !== 'uncertain') {
    return status
  }
  if (attackRise <= NO_ATTACK_RISE) {
    return 'rejected'
  }

  return attackRise >= ATTACK_RISE ? 'confirmed' : 'uncertain'
}

function measureAttackShape(
  frames: Frame[],
  frameSeconds: number,
): { attackRise: number, attackSlope: number } {
  if (frames.length < 2) {
    return { attackRise: 0, attackSlope: 0 }
  }

  const logLevels = frames.map(frame => toLogLevel(frame.level))
  const peakIndex = logLevels.indexOf(Math.max(...logLevels))
  const minimumBeforePeak = Math.min(...logLevels.slice(0, peakIndex + 1))
  const attackSlope = logLevels.slice(1).reduce((steepest, logLevel, index) =>
    Math.max(steepest, (logLevel - logLevels[index]!) / frameSeconds), 0)

  return { attackRise: logLevels[peakIndex]! - minimumBeforePeak, attackSlope }
}

function classifyScore(score: number): OnsetEvidenceStatus {
  if (score >= CONFIRMED_SCORE) {
    return 'confirmed'
  }

  return score <= REJECTED_SCORE ? 'rejected' : 'uncertain'
}

type Frame = { seconds: number, level: number }

function collectFrames(
  samples: PitchEnergySamples,
  startSeconds: number,
  endSeconds: number,
): Frame[] {
  return samples.values
    .map((level, index) => ({
      seconds: samples.startSeconds + index * samples.frameSeconds,
      level,
    }))
    .filter(frame => frame.seconds >= startSeconds && frame.seconds <= endSeconds)
}

function averageLevel(frames: Frame[]): number {
  if (frames.length === 0) {
    return 0
  }

  return frames.reduce((total, frame) => total + frame.level, 0) / frames.length
}

function peakLevel(frames: Frame[]): number {
  return frames.reduce((peak, frame) => Math.max(peak, frame.level), 0)
}

type LogTrend = { intercept: number, slope: number }

function fitLogTrend(frames: Frame[]): LogTrend {
  const meanSeconds = frames.reduce((total, frame) => total + frame.seconds, 0) / frames.length
  const meanLogLevel = frames.reduce((total, frame) => total + toLogLevel(frame.level), 0)
    / frames.length
  const covariance = frames.reduce((total, frame) =>
    total + (frame.seconds - meanSeconds) * (toLogLevel(frame.level) - meanLogLevel), 0)
  const variance = frames.reduce((total, frame) => total + (frame.seconds - meanSeconds) ** 2, 0)
  const slope = variance === 0 ? 0 : covariance / variance

  return { slope, intercept: meanLogLevel - slope * meanSeconds }
}

function estimateDispersion(frames: Frame[], trend: LogTrend): number {
  const residuals = frames.map(frame =>
    Math.abs(toLogLevel(frame.level) - (trend.intercept + trend.slope * frame.seconds)))
  return 1.4826 * median(residuals)
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

function toLogLevel(level: number): number {
  return Math.log(Math.max(level, LEVEL_EPSILON))
}
