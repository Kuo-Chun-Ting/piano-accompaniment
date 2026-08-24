import type { ScoreNote, ScorePedalInterval, ScoreVersion } from '../arrangement/types'

export const BEATS_PER_MEASURE = 4

export type PlaybackEvent = {
  id: string
  measureIndex: number
  staffId: 'treble' | 'bass'
  voiceId: string
  eventIndex: number
  startBeat: number
  durationBeats: number
  startSeconds: number
  durationSeconds: number
  pitches: string[]
  velocity?: number
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

type NotationEventInput = {
  baseEvent: Omit<PlaybackEvent, 'pitches'>
  notes: ScoreNote[]
  sequence: number
}

export function buildPlaybackSchedule(version: ScoreVersion, bpm: number): PlaybackSchedule {
  const secondsPerBeat = 60 / bpm
  const events = buildNotationEvents(version.measures, secondsPerBeat)
  applyPedalSustain(events, version.pedalIntervals ?? [], secondsPerBeat)

  return {
    events: events.sort((left, right) => left.startSeconds - right.startSeconds),
    totalDurationSeconds: version.measures.length * BEATS_PER_MEASURE * secondsPerBeat,
    secondsPerBeat,
    measureCount: version.measures.length,
  }
}

function applyPedalSustain(
  events: PlaybackEvent[],
  intervals: ScorePedalInterval[],
  secondsPerBeat: number,
): void {
  for (const event of events) {
    if (event.pitches.length === 0) {
      continue
    }

    const startBeatOffset = event.measureIndex * BEATS_PER_MEASURE + event.startBeat - 1
    const endBeatOffset = startBeatOffset + event.durationBeats
    const pedal = intervals.find(interval =>
      interval.startBeatOffset <= endBeatOffset && endBeatOffset < interval.endBeatOffset)
    if (!pedal) {
      continue
    }

    event.durationBeats = pedal.endBeatOffset - startBeatOffset
    event.durationSeconds = event.durationBeats * secondsPerBeat
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

function buildNotationEvents(
  measures: ScoreVersion['measures'],
  secondsPerBeat: number,
): PlaybackEvent[] {
  const playbackEvents: PlaybackEvent[] = []
  const tiedEventsByPitch = new Map<string, PlaybackEvent>()

  for (const { baseEvent, notes } of collectNotationEvents(measures, secondsPerBeat)) {
    if (notes.length === 0) {
      playbackEvents.push({ ...baseEvent, pitches: [] })
    }

    for (const note of notes) {
      const tieKey = `${baseEvent.staffId}:${note.pitch}`
      const previous = tiedEventsByPitch.get(tieKey)
      let current: PlaybackEvent
      if (note.tieFromPrevious && previous) {
        previous.durationBeats += baseEvent.durationBeats
        previous.durationSeconds += baseEvent.durationBeats * secondsPerBeat
        current = previous
      } else {
        current = { ...baseEvent, pitches: [note.pitch] }
        playbackEvents.push(current)
      }

      if (note.tieToNext) {
        tiedEventsByPitch.set(tieKey, current)
      } else {
        tiedEventsByPitch.delete(tieKey)
      }
    }
  }

  return playbackEvents
}

function collectNotationEvents(
  measures: ScoreVersion['measures'],
  secondsPerBeat: number,
): NotationEventInput[] {
  const events: NotationEventInput[] = []
  let sequence = 0

  measures.forEach((measure, measureIndex) => {
    measure.staves.forEach((staff) => {
      staff.voices.forEach((voice) => {
        voice.events.forEach((event, eventIndex) => {
          const baseEvent = {
            id: `measure-${measureIndex}-${staff.id}-${voice.id}-${eventIndex}`,
            measureIndex,
            staffId: staff.id,
            voiceId: voice.id,
            eventIndex,
            startBeat: event.startBeat,
            durationBeats: event.durationBeats,
            startSeconds: (measureIndex * BEATS_PER_MEASURE + event.startBeat - 1) * secondsPerBeat,
            durationSeconds: event.durationBeats * secondsPerBeat,
          }

          events.push({ baseEvent, notes: event.notes, sequence })
          sequence += 1
        })
      })
    })
  })

  return events.sort((left, right) =>
    left.baseEvent.startSeconds - right.baseEvent.startSeconds
    || left.sequence - right.sequence)
}
