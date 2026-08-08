type PlacementDuration = {
  durationBeats: number
}

const BEATS_PER_MEASURE = 4

export function buildPlacementGridTemplate(placements: PlacementDuration[]): string {
  return placements
    .map((placement) => `${Math.max(placement.durationBeats, 0.5)}fr`)
    .join(' ')
}

export function getMeasureBeatTotal(placements: PlacementDuration[]): number {
  return placements.reduce((total, placement) => total + placement.durationBeats, 0)
}

export function getMeasureBeatState(placements: PlacementDuration[]): {
  total: number
  status: 'complete' | 'incomplete' | 'overflow'
} {
  const total = getMeasureBeatTotal(placements)
  const status = total === BEATS_PER_MEASURE
    ? 'complete'
    : total < BEATS_PER_MEASURE ? 'incomplete' : 'overflow'

  return { total, status }
}
