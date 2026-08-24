import type { ScoreMeasure } from '../arrangement/types'
import type { PlaybackPosition } from '../audio/playbackSchedule'

export type ScoreSystem = {
  startMeasureIndex: number
  measures: ScoreMeasure[]
  measureLayoutUnits: number[]
  isFinalSystem: boolean
}

export type ScoreSeekTarget = {
  measureIndex: number
  measureProgress: number
}

const SCORE_LAYOUT_UNITS_PER_SYSTEM = 4

export function buildScoreSystems(measures: ScoreMeasure[]): ScoreSystem[] {
  const systems: ScoreSystem[] = []
  let currentMeasures: ScoreMeasure[] = []
  let currentUnits: number[] = []

  measures.forEach((measure, measureIndex) => {
    const measureUnits = getMeasureLayoutUnits(measure)
    if (currentMeasures.length > 0
      && sum(currentUnits) + measureUnits > SCORE_LAYOUT_UNITS_PER_SYSTEM) {
      systems.push(buildSystem(measureIndex - currentMeasures.length, currentMeasures, currentUnits))
      currentMeasures = []
      currentUnits = []
    }
    currentMeasures.push(measure)
    currentUnits.push(measureUnits)
  })

  if (currentMeasures.length > 0) {
    systems.push(buildSystem(measures.length - currentMeasures.length, currentMeasures, currentUnits))
  }
  return markFinalSystem(systems)
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
      measureLayoutUnits: measures
        .slice(startMeasureIndex, startMeasureIndex + measuresPerSystem)
        .map(() => 1),
      isFinalSystem: false,
    })
  }
  return markFinalSystem(systems)
}

export function getScoreSystemMeasureWidths(
  system: ScoreSystem,
  contentWidth: number,
): number[] {
  const occupiedUnits = getSystemLayoutUnits(system)
  const unitWidth = contentWidth / occupiedUnits
  return system.measureLayoutUnits.map(units => units * unitWidth)
}

export function fitTextWithinBounds(
  preferredX: number,
  textWidth: number,
  minimumX: number,
  maximumX: number,
): number {
  const maximumStartX = Math.max(minimumX, maximumX - textWidth)
  return Math.min(Math.max(preferredX, minimumX), maximumStartX)
}

function getMeasureLayoutUnits(measure: ScoreMeasure): number {
  const rhythmicPositionCount = new Set(measure.staves.flatMap(staff =>
    staff.voices.flatMap(voice => voice.events
      .filter(event => !event.isSpacer)
      .map(event => event.startBeat)))).size
  if (rhythmicPositionCount > 18) {
    return 3
  }
  return rhythmicPositionCount > 8 ? 2 : 1
}

function buildSystem(
  startMeasureIndex: number,
  measures: ScoreMeasure[],
  measureLayoutUnits: number[],
): ScoreSystem {
  return {
    startMeasureIndex,
    measures,
    measureLayoutUnits,
    isFinalSystem: false,
  }
}

function markFinalSystem(systems: ScoreSystem[]): ScoreSystem[] {
  return systems.map((system, index) => ({
    ...system,
    isFinalSystem: index === systems.length - 1,
  }))
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
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

  const precedingUnits = sum(system.measureLayoutUnits.slice(0, measureOffset))
  const measureUnits = system.measureLayoutUnits[measureOffset] ?? 1
  return (
    precedingUnits + playbackPosition.measureProgress * measureUnits
  ) / getSystemLayoutUnits(system)
}

export function getScoreSystemSeekTarget(
  system: ScoreSystem,
  progress: number,
): ScoreSeekTarget {
  const clampedProgress = Math.min(Math.max(progress, 0), 1)
  const finalMeasureIndex = system.startMeasureIndex + system.measures.length - 1
  const targetUnits = clampedProgress * getSystemLayoutUnits(system)
  const contentUnits = sum(system.measureLayoutUnits)
  if (targetUnits >= contentUnits) {
    return {
      measureIndex: finalMeasureIndex,
      measureProgress: 1,
    }
  }

  let precedingUnits = 0
  for (let measureOffset = 0; measureOffset < system.measureLayoutUnits.length; measureOffset += 1) {
    const measureUnits = system.measureLayoutUnits[measureOffset]!
    if (targetUnits < precedingUnits + measureUnits) {
      return {
        measureIndex: system.startMeasureIndex + measureOffset,
        measureProgress: (targetUnits - precedingUnits) / measureUnits,
      }
    }
    precedingUnits += measureUnits
  }

  return { measureIndex: finalMeasureIndex, measureProgress: 1 }
}

function getSystemLayoutUnits(system: ScoreSystem): number {
  return system.isFinalSystem
    ? SCORE_LAYOUT_UNITS_PER_SYSTEM
    : sum(system.measureLayoutUnits)
}
