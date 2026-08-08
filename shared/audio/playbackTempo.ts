export const DEFAULT_PLAYBACK_BPM = 72
export const MIN_PLAYBACK_BPM = 40
export const MAX_PLAYBACK_BPM = 200

export function resolveInitialPlaybackBpm(sourceBpm: number | null): number {
  return normalizePlaybackBpm(sourceBpm ?? DEFAULT_PLAYBACK_BPM, DEFAULT_PLAYBACK_BPM)
}

export function normalizePlaybackBpm(value: number, fallbackBpm: number): number {
  if (!Number.isFinite(value)) {
    return fallbackBpm
  }

  return Math.min(MAX_PLAYBACK_BPM, Math.max(MIN_PLAYBACK_BPM, Math.round(value)))
}
