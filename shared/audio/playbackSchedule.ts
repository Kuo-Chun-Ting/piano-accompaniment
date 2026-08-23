import type { ScorePedalInterval, ScoreVersion } from '../arrangement/types'

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

export function buildPlaybackSchedule(version: ScoreVersion, bpm: number): PlaybackSchedule {
  const secondsPerBeat = 60 / bpm
  const events = version.playbackNotes?.length
    ? buildPrecisePlaybackEvents(version.playbackNotes, secondsPerBeat)
    : [
        ...buildHandEvents(version.measures, 'right', secondsPerBeat),
        ...buildHandEvents(version.measures, 'left', secondsPerBeat),
      ]
  applyPedalSustain(events, version.pedalIntervals ?? [], secondsPerBeat)

  return {
    events: events.sort((left, right) => left.startSeconds - right.startSeconds),
    totalDurationSeconds: version.measures.length * BEATS_PER_MEASURE * secondsPerBeat,
    secondsPerBeat,
    measureCount: version.measures.length,
  }
}

function buildPrecisePlaybackEvents(
  notes: NonNullable<ScoreVersion['playbackNotes']>,
  secondsPerBeat: number,
): PlaybackEvent[] {
  return notes.map((note, index) => {
    const measureIndex = Math.floor(note.startBeatOffset / BEATS_PER_MEASURE)
    return {
      id: `playback-note-${index}`,
      measureIndex,
      hand: pitchToMidi(note.pitch) >= 60 ? 'right' : 'left',
      eventIndex: index,
      startBeat: note.startBeatOffset - measureIndex * BEATS_PER_MEASURE + 1,
      durationBeats: note.durationBeats,
      startSeconds: note.startBeatOffset * secondsPerBeat,
      durationSeconds: note.durationBeats * secondsPerBeat,
      pitches: [note.pitch],
      velocity: note.velocity,
    }
  })
}

function pitchToMidi(pitch: string): number {
  const match = pitch.match(/^([A-G])([#b]?)(\d)$/)
  if (!match) {
    return Number.NaN
  }
  const semitones = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 } as const
  const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0
  return (Number(match[3]) + 1) * 12
    + semitones[match[1] as keyof typeof semitones]
    + accidental
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

function buildHandEvents(
  measures: ScoreVersion['measures'],
  hand: PlaybackHand,
  secondsPerBeat: number,
): PlaybackEvent[] {
  const playbackEvents: PlaybackEvent[] = []
  const tiedEventsByPitch = new Map<string, PlaybackEvent>()

  measures.forEach((measure, measureIndex) => {
    const scoreEvents = hand === 'right' ? measure.rightHand : measure.leftHand

    scoreEvents.forEach((event, eventIndex) => {
      const baseEvent = {
        id: `measure-${measureIndex}-${hand}-${eventIndex}`,
        measureIndex,
        hand,
        eventIndex,
        startBeat: event.startBeat,
        durationBeats: event.durationBeats,
        startSeconds: (measureIndex * BEATS_PER_MEASURE + event.startBeat - 1) * secondsPerBeat,
        durationSeconds: event.durationBeats * secondsPerBeat,
      }
      const tiedFromPrevious = new Set(
        event.tieFromPreviousPitches ?? (event.tieFromPrevious ? event.pitches : []),
      )
      const tiedToNext = new Set(
        event.tieToNextPitches ?? (event.tieToNext ? event.pitches : []),
      )

      if (event.pitches.length === 0) {
        playbackEvents.push({ ...baseEvent, pitches: [] })
      }

      event.pitches.forEach((pitch) => {
        const previous = tiedEventsByPitch.get(pitch)
        if (tiedFromPrevious.has(pitch) && previous) {
          previous.durationBeats += event.durationBeats
          previous.durationSeconds += event.durationBeats * secondsPerBeat
        } else {
          playbackEvents.push({ ...baseEvent, pitches: [pitch] })
        }

        const current = playbackEvents.at(-1)!
        if (tiedToNext.has(pitch)) {
          tiedEventsByPitch.set(pitch, previous && tiedFromPrevious.has(pitch) ? previous : current)
        } else {
          tiedEventsByPitch.delete(pitch)
        }
      })
    })
  })

  return playbackEvents
}
