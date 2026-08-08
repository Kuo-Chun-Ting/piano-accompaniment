import type { ScoreVersion } from '../arrangement/types'

export const BEATS_PER_MEASURE = 4

export type PlaybackHand = 'left' | 'right'

export type PlaybackEvent = {
  id: string
  measureIndex: number
  hand: PlaybackHand
  eventIndex: number
  startBeat: number
  durationBeats: number
  startSeconds: number
  durationSeconds: number
  pitches: string[]
}

export type PlaybackSchedule = {
  events: PlaybackEvent[]
  totalDurationSeconds: number
  secondsPerBeat: number
  measureCount: number
}

export type PlaybackPosition = {
  elapsedSeconds: number
  totalDurationSeconds: number
  progress: number
  measureIndex: number
  measureProgress: number
  beat: number
  activeEventIds: string[]
}

export function buildPlaybackSchedule(version: ScoreVersion, bpm: number): PlaybackSchedule {
  const secondsPerBeat = 60 / bpm
  const events = version.measures.flatMap((measure, measureIndex) =>
    [
      ...buildHandEvents(measure.rightHand, measureIndex, 'right', secondsPerBeat),
      ...buildHandEvents(measure.leftHand, measureIndex, 'left', secondsPerBeat),
    ],
  )

  return {
    events: events.sort((left, right) => left.startSeconds - right.startSeconds),
    totalDurationSeconds: version.measures.length * BEATS_PER_MEASURE * secondsPerBeat,
    secondsPerBeat,
    measureCount: version.measures.length,
  }
}

export function buildPlaybackPosition(
  schedule: PlaybackSchedule,
  elapsedSeconds: number,
): PlaybackPosition {
  const elapsed = Math.min(Math.max(elapsedSeconds, 0), schedule.totalDurationSeconds)
  const measureDurationSeconds = BEATS_PER_MEASURE * schedule.secondsPerBeat
  const atEnd = elapsed === schedule.totalDurationSeconds && schedule.measureCount > 0
  const measureIndex = atEnd
    ? schedule.measureCount - 1
    : Math.min(Math.floor(elapsed / measureDurationSeconds), Math.max(schedule.measureCount - 1, 0))
  const measureElapsed = atEnd ? measureDurationSeconds : elapsed - measureIndex * measureDurationSeconds
  const measureProgress = measureDurationSeconds === 0 ? 0 : measureElapsed / measureDurationSeconds
  const beat = atEnd ? BEATS_PER_MEASURE : measureProgress * BEATS_PER_MEASURE + 1

  return {
    elapsedSeconds: elapsed,
    totalDurationSeconds: schedule.totalDurationSeconds,
    progress: schedule.totalDurationSeconds === 0 ? 0 : elapsed / schedule.totalDurationSeconds,
    measureIndex,
    measureProgress,
    beat,
    activeEventIds: schedule.events
      .filter((event) => event.startSeconds <= elapsed && elapsed < event.startSeconds + event.durationSeconds)
      .map((event) => event.id),
  }
}

export function getMeasureSeekSeconds(measureIndex: number, measureProgress: number, bpm: number): number {
  const clampedProgress = Math.min(Math.max(measureProgress, 0), 1)
  return (measureIndex * BEATS_PER_MEASURE + clampedProgress * BEATS_PER_MEASURE) * (60 / bpm)
}

export function retimePlaybackSeconds(
  elapsedSeconds: number,
  fromSecondsPerBeat: number,
  toBpm: number,
): number {
  const absoluteBeatOffset = elapsedSeconds / fromSecondsPerBeat
  return absoluteBeatOffset * (60 / toBpm)
}

function buildHandEvents(
  events: ScoreVersion['measures'][number]['rightHand'],
  measureIndex: number,
  hand: PlaybackHand,
  secondsPerBeat: number,
): PlaybackEvent[] {
  return events.map((event, eventIndex) => ({
    id: `measure-${measureIndex}-${hand}-${eventIndex}`,
    measureIndex,
    hand,
    eventIndex,
    startBeat: event.startBeat,
    durationBeats: event.durationBeats,
    startSeconds: (measureIndex * BEATS_PER_MEASURE + event.startBeat - 1) * secondsPerBeat,
    durationSeconds: event.durationBeats * secondsPerBeat,
    pitches: event.pitches,
  }))
}
