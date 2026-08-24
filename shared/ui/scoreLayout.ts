export const SCORE_SYSTEM_LAYOUT = {
  height: 332,
  trebleStaveY: 56,
  bassStaveY: 166,
  chordBaselineY: 28,
} as const

export function getScoreCueX(
  startBeat: number,
  noteStartX: number,
  noteEndX: number,
): number {
  const measureProgress = Math.min(1, Math.max(0, (startBeat - 1) / 4))
  return noteStartX + (noteEndX - noteStartX) * measureProgress
}
