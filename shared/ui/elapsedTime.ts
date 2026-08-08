export function formatElapsedTime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const minutesPart = Math.floor(seconds / 60).toString().padStart(2, '0')
  const secondsPart = (seconds % 60).toString().padStart(2, '0')
  return `${minutesPart}:${secondsPart}`
}
