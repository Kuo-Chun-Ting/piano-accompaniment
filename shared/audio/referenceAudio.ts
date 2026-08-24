export type ReferenceAudio = {
  src: string
  scoreStartSeconds: number
  sourceBpm: number
  beatSeconds: number[]
}

export function getReferenceAudioSeconds(
  referenceAudio: ReferenceAudio,
  beatOffset: number,
): number {
  const beats = getScoreBeats(referenceAudio)
  const clampedBeatOffset = Math.max(beatOffset, 0)
  const beatIndex = Math.floor(clampedBeatOffset)
  const beatProgress = clampedBeatOffset - beatIndex
  const start = beats[beatIndex]

  if (start !== undefined) {
    const end = beats[beatIndex + 1]
    if (end !== undefined) {
      return start + (end - start) * beatProgress
    }
    return start + beatProgress * 60 / referenceAudio.sourceBpm
  }

  const finalBeatIndex = beats.length - 1
  return beats[finalBeatIndex]!
    + (clampedBeatOffset - finalBeatIndex) * 60 / referenceAudio.sourceBpm
}

export function getReferenceAudioBeatOffset(
  referenceAudio: ReferenceAudio,
  audioSeconds: number,
): number {
  const beats = getScoreBeats(referenceAudio)
  if (audioSeconds <= beats[0]!) {
    return 0
  }

  for (let index = 0; index < beats.length - 1; index += 1) {
    const start = beats[index]!
    const end = beats[index + 1]!
    if (audioSeconds <= end) {
      return index + (audioSeconds - start) / (end - start)
    }
  }

  const finalBeatIndex = beats.length - 1
  return finalBeatIndex
    + (audioSeconds - beats[finalBeatIndex]!) * referenceAudio.sourceBpm / 60
}

export function getReferenceAudioPlaybackRate(sourceBpm: number, playbackBpm: number): number {
  return playbackBpm / sourceBpm
}

function getScoreBeats(referenceAudio: ReferenceAudio): number[] {
  return [
    referenceAudio.scoreStartSeconds,
    ...referenceAudio.beatSeconds.filter(seconds => seconds > referenceAudio.scoreStartSeconds),
  ]
}
