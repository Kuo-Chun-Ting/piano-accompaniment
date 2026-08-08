import type { ConfirmedSection } from '../schemas/chart'

export type MeasureGroupingIssue = {
  sectionId: string
  measureIndex: number
  type: 'overflow' | 'incomplete'
  totalBeats: number
}

export type MeasureGroupingResult = {
  sections: ConfirmedSection[]
  issues: MeasureGroupingIssue[]
}

type PlacementWithDuration = {
  durationBeats: number
}

type MeasureWithPlacements<Placement extends PlacementWithDuration> = {
  index: number
  lyric: string | null
  sourceMeasureIndexes: number[]
  sourceLyricConfidence?: 'visible' | 'uncertain' | 'missing'
  lyricConfirmedByUser?: boolean
  chords: Placement[]
}

type SourcePlacement<Placement extends PlacementWithDuration> = {
  placement: Placement
  sourceMeasureIndex: number
  sourceLyric: string | null
  sourceLyricConfidence?: 'visible' | 'uncertain' | 'missing'
  lyricConfirmedByUser?: boolean
}

export type GroupedMeasuresResult<Placement extends PlacementWithDuration> = {
  measures: Array<MeasureWithPlacements<Placement>>
  issues: MeasureGroupingIssue[]
}

export function groupSectionsIntoMeasures(sections: ConfirmedSection[]): MeasureGroupingResult {
  const issues: MeasureGroupingIssue[] = []
  const groupedSections = sections.map((section) => {
    const grouped = groupMeasuresByDuration(section.id, section.measures)
    issues.push(...grouped.issues)
    return { ...section, measures: grouped.measures }
  })

  return { sections: groupedSections, issues }
}

export function groupMeasuresByDuration<Placement extends PlacementWithDuration>(
  sectionId: string,
  sourceMeasures: Array<{
    lyric?: string | null
    sourceLyricConfidence?: 'visible' | 'uncertain' | 'missing'
    lyricConfirmedByUser?: boolean
    chords: Placement[]
  }>,
): GroupedMeasuresResult<Placement> {
  const placements = buildSourcePlacements(sourceMeasures)
  const measures: Array<MeasureWithPlacements<Placement>> = []
  const issues: MeasureGroupingIssue[] = []
  let currentPlacements: Array<SourcePlacement<Placement>> = []
  let currentBeats = 0

  for (const sourcePlacement of placements) {
    currentPlacements.push(sourcePlacement)
    currentBeats += sourcePlacement.placement.durationBeats

    if (currentBeats >= 4) {
      finishMeasure(sectionId, measures, currentPlacements, currentBeats, issues)
      currentPlacements = []
      currentBeats = 0
    }
  }

  if (currentPlacements.length > 0) {
    measures.push(buildMeasure(measures.length + 1, currentPlacements))
    issues.push(buildIssue(sectionId, measures.length, 'incomplete', currentBeats))
  }

  return { measures, issues }
}

function buildSourcePlacements<Placement extends PlacementWithDuration>(
  sourceMeasures: Array<{
    lyric?: string | null
    sourceLyricConfidence?: 'visible' | 'uncertain' | 'missing'
    lyricConfirmedByUser?: boolean
    chords: Placement[]
  }>,
): Array<SourcePlacement<Placement>> {
  return sourceMeasures.flatMap((measure, sourceMeasureIndex) =>
    measure.chords.map((placement) => ({
      placement,
      sourceMeasureIndex,
      sourceLyric: measure.lyric ?? null,
      sourceLyricConfidence: measure.sourceLyricConfidence,
      lyricConfirmedByUser: measure.lyricConfirmedByUser,
    })),
  )
}

function finishMeasure<Placement extends PlacementWithDuration>(
  sectionId: string,
  measures: Array<MeasureWithPlacements<Placement>>,
  sourcePlacements: Array<SourcePlacement<Placement>>,
  totalBeats: number,
  issues: MeasureGroupingIssue[],
): void {
  const measureIndex = measures.length + 1
  measures.push(buildMeasure(measureIndex, sourcePlacements))

  if (totalBeats > 4) {
    issues.push(buildIssue(sectionId, measureIndex, 'overflow', totalBeats))
  }
}

function buildMeasure<Placement extends PlacementWithDuration>(
  index: number,
  sourcePlacements: Array<SourcePlacement<Placement>>,
): MeasureWithPlacements<Placement> {
  return {
    index,
    lyric: buildMeasureLyric(sourcePlacements),
    sourceMeasureIndexes: buildSourceMeasureIndexes(sourcePlacements),
    sourceLyricConfidence: resolveGroupedLyricConfidence(sourcePlacements),
    lyricConfirmedByUser: resolveGroupedLyricConfirmation(sourcePlacements),
    chords: sourcePlacements.map((sourcePlacement) => sourcePlacement.placement),
  }
}

function buildSourceMeasureIndexes<Placement extends PlacementWithDuration>(
  sourcePlacements: Array<SourcePlacement<Placement>>,
): number[] {
  return [...new Set(sourcePlacements.map((sourcePlacement) => sourcePlacement.sourceMeasureIndex))]
}

function buildMeasureLyric<Placement extends PlacementWithDuration>(
  sourcePlacements: Array<SourcePlacement<Placement>>,
): string | null {
  const lyrics: string[] = []
  const seenSourceMeasures = new Set<number>()

  for (const sourcePlacement of sourcePlacements) {
    if (sourcePlacement.sourceLyric && !seenSourceMeasures.has(sourcePlacement.sourceMeasureIndex)) {
      lyrics.push(sourcePlacement.sourceLyric)
    }

    seenSourceMeasures.add(sourcePlacement.sourceMeasureIndex)
  }

  return lyrics.length > 0 ? lyrics.join('') : null
}

function resolveGroupedLyricConfidence<Placement extends PlacementWithDuration>(
  sourcePlacements: Array<SourcePlacement<Placement>>,
): 'visible' | 'uncertain' | 'missing' | undefined {
  const confidences = sourcePlacements
    .map((sourcePlacement) => sourcePlacement.sourceLyricConfidence)
    .filter((confidence) => confidence !== undefined)

  if (confidences.includes('uncertain')) {
    return 'uncertain'
  }

  if (confidences.includes('visible')) {
    return 'visible'
  }

  return confidences.length > 0 ? 'missing' : undefined
}

function resolveGroupedLyricConfirmation<Placement extends PlacementWithDuration>(
  sourcePlacements: Array<SourcePlacement<Placement>>,
): boolean | undefined {
  const confirmations = sourcePlacements
    .map((sourcePlacement) => sourcePlacement.lyricConfirmedByUser)
    .filter((confirmed) => confirmed !== undefined)

  return confirmations.length > 0
    ? confirmations.every((confirmed) => confirmed)
    : undefined
}

function buildIssue(
  sectionId: string,
  measureIndex: number,
  type: MeasureGroupingIssue['type'],
  totalBeats: number,
): MeasureGroupingIssue {
  return { sectionId, measureIndex, type, totalBeats }
}
