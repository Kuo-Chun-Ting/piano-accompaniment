import type { PitchEnergyFile } from './onsetCleaning'
import type { PitchEnergySamples } from './onsetEvidence'
import { groupTranscribedNotesByOnset } from './midiToScore'
import type { TranscribedNote, TranscribedPedalEvent } from './types'

const MINIMUM_SUSTAIN_AFTER_ATTACK_SECONDS = 0.1
const SUSTAIN_PROBE_DELAY_SECONDS = 0.05
const SUSTAIN_PROBE_WINDOW_SECONDS = 0.1
const MINIMUM_SUSTAINED_PITCHES = 2
const ENERGY_ABOVE_NOISE_FACTOR = 2

type PedalIntervalSeconds = {
  startSeconds: number
  endSeconds: number
}

export function inferSustainPedalEvents(
  notes: TranscribedNote[],
  energy: PitchEnergyFile,
): TranscribedPedalEvent[] {
  const groups = groupTranscribedNotesByOnset(notes)
  const samplesByPitch = new Map(energy.pitches.map(samples => [samples.midi, samples]))
  const intervals: PedalIntervalSeconds[] = []

  groups.forEach((group, groupIndex) => {
    const nextAttackSeconds = groups[groupIndex + 1]?.[0]?.startSeconds
    if (nextAttackSeconds === undefined) {
      return
    }

    const sustainedNotes = group.filter(note =>
      note.endSeconds >= nextAttackSeconds + MINIMUM_SUSTAIN_AFTER_ATTACK_SECONDS
      && hasAudibleEnergy(
        samplesByPitch.get(note.midi),
        nextAttackSeconds + SUSTAIN_PROBE_DELAY_SECONDS,
        energy.noiseFloor,
      ))
    if (sustainedNotes.length < MINIMUM_SUSTAINED_PITCHES) {
      return
    }

    const nextChordSeconds = groups
      .slice(groupIndex + 1)
      .find(candidate => candidate.length >= MINIMUM_SUSTAINED_PITCHES)?.[0]?.startSeconds
    intervals.push({
      startSeconds: group[0]!.startSeconds,
      endSeconds: Math.min(
        Math.max(...sustainedNotes.map(note => note.endSeconds)),
        nextChordSeconds ?? Number.POSITIVE_INFINITY,
      ),
    })
  })

  return intervalsToPedalEvents(intervals)
}

export function mergePedalEvents(
  detected: TranscribedPedalEvent[],
  inferred: TranscribedPedalEvent[],
): TranscribedPedalEvent[] {
  const detectedIntervals = pedalEventsToIntervals(detected)
  const inferredIntervals = pedalEventsToIntervals(inferred)
    .flatMap(interval => subtractIntervals(interval, detectedIntervals))
  return intervalsToPedalEvents(
    [...detectedIntervals, ...inferredIntervals]
      .sort((left, right) => left.startSeconds - right.startSeconds),
  )
}

function hasAudibleEnergy(
  samples: PitchEnergySamples | undefined,
  probeStartSeconds: number,
  noiseFloor: number,
): boolean {
  if (!samples) {
    return false
  }

  const probeEndSeconds = probeStartSeconds + SUSTAIN_PROBE_WINDOW_SECONDS
  const levels = samples.values.filter((_, index) => {
    const seconds = samples.startSeconds + index * samples.frameSeconds
    return seconds >= probeStartSeconds && seconds <= probeEndSeconds
  })
  if (levels.length === 0) {
    return false
  }

  const averageLevel = levels.reduce((sum, level) => sum + level, 0) / levels.length
  return averageLevel >= noiseFloor * ENERGY_ABOVE_NOISE_FACTOR
}

function pedalEventsToIntervals(events: TranscribedPedalEvent[]): PedalIntervalSeconds[] {
  const intervals: PedalIntervalSeconds[] = []
  let startSeconds: number | null = null

  for (const event of [...events].sort((left, right) => left.timeSeconds - right.timeSeconds)) {
    if (!Number.isFinite(event.timeSeconds) || !Number.isInteger(event.value)) {
      continue
    }
    if (event.value >= 64) {
      startSeconds ??= event.timeSeconds
    } else if (startSeconds !== null && event.timeSeconds > startSeconds) {
      intervals.push({ startSeconds, endSeconds: event.timeSeconds })
      startSeconds = null
    }
  }

  return intervals
}

function subtractIntervals(
  interval: PedalIntervalSeconds,
  blockers: PedalIntervalSeconds[],
): PedalIntervalSeconds[] {
  return blockers.reduce<PedalIntervalSeconds[]>((segments, blocker) =>
    segments.flatMap((segment) => {
      if (blocker.endSeconds <= segment.startSeconds || blocker.startSeconds >= segment.endSeconds) {
        return [segment]
      }

      return [
        { startSeconds: segment.startSeconds, endSeconds: Math.min(blocker.startSeconds, segment.endSeconds) },
        { startSeconds: Math.max(blocker.endSeconds, segment.startSeconds), endSeconds: segment.endSeconds },
      ].filter(candidate => candidate.endSeconds > candidate.startSeconds)
    }), [interval])
}

function intervalsToPedalEvents(intervals: PedalIntervalSeconds[]): TranscribedPedalEvent[] {
  return intervals.flatMap(interval => [
    { timeSeconds: interval.startSeconds, value: 127 },
    { timeSeconds: interval.endSeconds, value: 0 },
  ])
}
