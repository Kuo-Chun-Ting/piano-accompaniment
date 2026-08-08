import type { ScoreMeasure } from '../arrangement/types'
import type { PlaybackPosition } from '../audio/playbackSchedule'

export type ScoreSystem = {
  startMeasureIndex: number
  measures: ScoreMeasure[]
}

export type ScoreSeekTarget = {
  measureIndex: number
  measureProgress: number
}

const SCORE_MEASURES_PER_SYSTEM = 4

export function buildScoreSystems(measures: ScoreMeasure[]): ScoreSystem[] {
  return groupScoreMeasures(measures, SCORE_MEASURES_PER_SYSTEM)
}

export function groupScoreMeasures(
  measures: ScoreMeasure[],
  measuresPerSystem: number,
): ScoreSystem[] {
  if (measuresPerSystem < 1) {
    return []
  }

  const systems: ScoreSystem[] = []
  for (let startMeasureIndex = 0; startMeasureIndex < measures.length; startMeasureIndex += measuresPerSystem) {
    systems.push({
      startMeasureIndex,
      measures: measures.slice(startMeasureIndex, startMeasureIndex + measuresPerSystem),
    })
  }
  return systems
}

export function getScoreSystemProgress(
  system: ScoreSystem,
  playbackPosition: PlaybackPosition,
): number {
  const measureOffset = playbackPosition.measureIndex - system.startMeasureIndex
  if (measureOffset < 0) {
    return 0
  }
  if (measureOffset >= system.measures.length) {
    return 1
  }

  return (measureOffset + playbackPosition.measureProgress) / system.measures.length
}

export function getScoreSystemSeekTarget(
  system: ScoreSystem,
  progress: number,
): ScoreSeekTarget {
  const clampedProgress = Math.min(Math.max(progress, 0), 1)
  if (clampedProgress === 1) {
    return {
      measureIndex: system.startMeasureIndex + system.measures.length - 1,
      measureProgress: 1,
    }
  }

  const measureOffset = Math.floor(clampedProgress * system.measures.length)
  return {
    measureIndex: system.startMeasureIndex + measureOffset,
    measureProgress: clampedProgress * system.measures.length - measureOffset,
  }
}
