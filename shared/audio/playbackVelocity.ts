const MAX_GAIN = 0.7

export function getPlaybackGain(velocity: number | undefined): number {
  if (velocity === undefined) {
    return MAX_GAIN
  }

  return Math.min(Math.max(velocity, 0), 127) / 127 * MAX_GAIN
}
