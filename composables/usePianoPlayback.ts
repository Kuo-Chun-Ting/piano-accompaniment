import type { ScoreVersion } from '~/shared/arrangement/types'
import {
  buildPlaybackPosition,
  buildPlaybackSchedule,
  retimePlaybackSeconds,
  type PlaybackEvent,
  type PlaybackPosition,
  type PlaybackSchedule,
} from '~/shared/audio/playbackSchedule'
import { normalizeSamplePitch, PIANO_SAMPLE_URLS } from '~/shared/audio/pianoSamples'

type PlaybackStatus = 'idle' | 'loading' | 'paused' | 'playing'

const PLAYBACK_DELAY_SECONDS = 0.05
const RELEASE_SECONDS = 0.12

const EMPTY_POSITION: PlaybackPosition = {
  elapsedSeconds: 0,
  totalDurationSeconds: 0,
  progress: 0,
  measureIndex: 0,
  measureProgress: 0,
  beat: 1,
  activeEventIds: [],
}

export function usePianoPlayback() {
  const status = ref<PlaybackStatus>('idle')
  const errorMessage = ref<string | null>(null)
  const position = ref<PlaybackPosition>({ ...EMPTY_POSITION })
  const activeSources = new Set<AudioBufferSourceNode>()
  let context: AudioContext | null = null
  let sampleBuffers: Map<string, AudioBuffer> | null = null
  let sampleLoading: Promise<Map<string, AudioBuffer>> | null = null
  let schedule: PlaybackSchedule | null = null
  let completionTimer: ReturnType<typeof setTimeout> | null = null
  let animationFrame: number | null = null
  let playbackStartedAt = 0
  let playbackOffsetSeconds = 0
  let requestId = 0

  async function togglePlayback(version: ScoreVersion, bpm: number): Promise<void> {
    if (status.value === 'playing') {
      pausePlayback()
      return
    }

    if (status.value === 'loading') {
      return
    }

    const startSeconds = position.value.progress >= 1 ? 0 : position.value.elapsedSeconds
    await startFrom(version, bpm, startSeconds)
  }

  async function seekPlayback(version: ScoreVersion, bpm: number, startSeconds: number): Promise<void> {
    await startFrom(version, bpm, startSeconds)
  }

  async function changePlaybackTempo(version: ScoreVersion, bpm: number): Promise<void> {
    if (!schedule) {
      schedule = buildPlaybackSchedule(version, bpm)
      position.value = buildPlaybackPosition(schedule, 0)
      return
    }

    if (status.value === 'playing') {
      updatePosition()
    }

    const nextOffsetSeconds = retimePlaybackSeconds(
      position.value.elapsedSeconds,
      schedule.secondsPerBeat,
      bpm,
    )

    if (status.value === 'playing') {
      await startFrom(version, bpm, nextOffsetSeconds)
      return
    }

    schedule = buildPlaybackSchedule(version, bpm)
    playbackOffsetSeconds = nextOffsetSeconds
    position.value = buildPlaybackPosition(schedule, nextOffsetSeconds)
  }

  function pausePlayback(): void {
    if (status.value !== 'playing') {
      return
    }

    updatePosition()
    clearScheduledPlayback()
    status.value = 'paused'
  }

  function stopPlayback(): void {
    requestId += 1
    clearScheduledPlayback()
    status.value = 'idle'
    position.value = schedule ? buildPlaybackPosition(schedule, 0) : { ...EMPTY_POSITION }
  }

  async function startFrom(version: ScoreVersion, bpm: number, startSeconds: number): Promise<void> {
    const currentRequestId = ++requestId
    clearScheduledPlayback()
    status.value = 'loading'
    errorMessage.value = null

    try {
      const audioContext = await getAudioContext()
      const buffers = await getSampleBuffers(audioContext)

      if (currentRequestId !== requestId) {
        return
      }

      startPlayback(audioContext, buffers, version, bpm, startSeconds)
    } catch {
      handlePlaybackError(currentRequestId)
    }
  }

  async function getAudioContext(): Promise<AudioContext> {
    context ??= new AudioContext()
    await context.resume()
    return context
  }

  async function getSampleBuffers(audioContext: AudioContext): Promise<Map<string, AudioBuffer>> {
    if (sampleBuffers) {
      return sampleBuffers
    }

    sampleLoading ??= loadSampleBuffers(audioContext)

    try {
      sampleBuffers = await sampleLoading
      return sampleBuffers
    } catch (error) {
      sampleLoading = null
      throw error
    }
  }

  function startPlayback(
    audioContext: AudioContext,
    buffers: Map<string, AudioBuffer>,
    version: ScoreVersion,
    bpm: number,
    requestedStartSeconds: number,
  ): void {
    schedule = buildPlaybackSchedule(version, bpm)
    playbackOffsetSeconds = Math.min(Math.max(requestedStartSeconds, 0), schedule.totalDurationSeconds)

    if (playbackOffsetSeconds >= schedule.totalDurationSeconds) {
      playbackOffsetSeconds = 0
    }

    playbackStartedAt = audioContext.currentTime + PLAYBACK_DELAY_SECONDS
    position.value = buildPlaybackPosition(schedule, playbackOffsetSeconds)
    schedule.events
      .filter((event) => event.startSeconds + event.durationSeconds > playbackOffsetSeconds)
      .forEach((event) => scheduleEvent(audioContext, buffers, event))

    const remainingSeconds = schedule.totalDurationSeconds - playbackOffsetSeconds
    completionTimer = setTimeout(finishPlayback, (remainingSeconds + PLAYBACK_DELAY_SECONDS) * 1000)
    status.value = 'playing'
    updateAnimationFrame()
  }

  function updateAnimationFrame(): void {
    updatePosition()

    if (status.value === 'playing') {
      animationFrame = requestAnimationFrame(updateAnimationFrame)
    }
  }

  function updatePosition(): void {
    if (!context || !schedule) {
      return
    }

    const playedSeconds = Math.max(0, context.currentTime - playbackStartedAt)
    position.value = buildPlaybackPosition(schedule, playbackOffsetSeconds + playedSeconds)
  }

  function finishPlayback(): void {
    if (!schedule) {
      return
    }

    clearScheduledPlayback()
    position.value = buildPlaybackPosition(schedule, schedule.totalDurationSeconds)
    status.value = 'idle'
  }

  function handlePlaybackError(failedRequestId: number): void {
    if (failedRequestId !== requestId) {
      return
    }

    stopPlayback()
    errorMessage.value = 'Could not load piano samples. Try again.'
  }

  function clearScheduledPlayback(): void {
    clearCompletionTimer()
    cancelPositionUpdates()
    stopActiveSources()
  }

  function clearCompletionTimer(): void {
    if (completionTimer === null) {
      return
    }

    clearTimeout(completionTimer)
    completionTimer = null
  }

  function cancelPositionUpdates(): void {
    if (animationFrame === null) {
      return
    }

    cancelAnimationFrame(animationFrame)
    animationFrame = null
  }

  function stopActiveSources(): void {
    activeSources.forEach((source) => {
      try {
        source.stop()
      } catch {
        // A source may already have ended naturally.
      }
    })
    activeSources.clear()
  }

  function scheduleEvent(
    audioContext: AudioContext,
    buffers: Map<string, AudioBuffer>,
    event: PlaybackEvent,
  ): void {
    const relativeStart = Math.max(0, event.startSeconds - playbackOffsetSeconds)
    const skippedDuration = Math.max(0, playbackOffsetSeconds - event.startSeconds)
    const remainingDuration = event.durationSeconds - skippedDuration

    event.pitches.forEach((pitch) => {
      schedulePitch(
        audioContext,
        buffers,
        pitch,
        playbackStartedAt + relativeStart,
        remainingDuration,
      )
    })
  }

  function schedulePitch(
    audioContext: AudioContext,
    buffers: Map<string, AudioBuffer>,
    pitch: string,
    startSeconds: number,
    durationSeconds: number,
  ): void {
    const buffer = buffers.get(normalizeSamplePitch(pitch))

    if (!buffer) {
      throw new Error(`Unsupported piano sample: ${pitch}`)
    }

    const source = audioContext.createBufferSource()
    const gain = audioContext.createGain()
    const releaseStart = startSeconds + Math.max(0, durationSeconds - RELEASE_SECONDS)

    source.buffer = buffer
    gain.gain.setValueAtTime(0.7, startSeconds)
    gain.gain.setValueAtTime(0.7, releaseStart)
    gain.gain.linearRampToValueAtTime(0, startSeconds + durationSeconds)
    source.connect(gain).connect(audioContext.destination)
    source.addEventListener('ended', () => activeSources.delete(source), { once: true })
    source.start(startSeconds)
    source.stop(startSeconds + durationSeconds + 0.02)
    activeSources.add(source)
  }

  onScopeDispose(() => {
    stopPlayback()
    void context?.close()
  })

  return {
    status,
    errorMessage,
    position,
    togglePlayback,
    seekPlayback,
    changePlaybackTempo,
    stopPlayback,
  }
}

async function loadSampleBuffers(audioContext: AudioContext): Promise<Map<string, AudioBuffer>> {
  const entries = await Promise.all(
    Object.entries(PIANO_SAMPLE_URLS).map(async ([pitch, url]) => {
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`Piano sample failed to load: ${pitch}`)
      }

      const buffer = await audioContext.decodeAudioData(await response.arrayBuffer())
      return [pitch, buffer] as const
    }),
  )

  return new Map(entries)
}
