import { groupMeasuresByDuration } from '../music/measureGrouping'
import { parseChordSymbol } from '../music/chords'
import type {
  ConfirmChartSelection,
  ExtractedChart,
  Mood,
  NormalizedKey,
} from '../schemas/chart'
import type {
  ChartEditorDocument,
  EditorMeasure,
  EditorPlacement,
} from './types'

const BEATS_PER_MEASURE = 4
export type MeasureInsertPosition = 'before' | 'after'
export type PlacementInsertPosition = 'before' | 'after'

export function createChartEditorDocument(chart: ExtractedChart): ChartEditorDocument {
  const sections = [...chart.sections].sort((left, right) => left.order - right.order)
  const firstSection = sections[0]
  if (!firstSection) throw new Error('Chart editor requires at least one section')

  return {
    measures: sections.flatMap(section => createSectionMeasures(section)),
    defaultSection: {
      id: firstSection.id,
      label: firstSection.label,
      order: firstSection.order,
    },
  }
}

export function getInvalidMeasureIds(document: ChartEditorDocument): string[] {
  return document.measures
    .filter(measure => !isValidMeasure(measure))
    .map(measure => measure.id)
}

export function canArrangeDocument(document: ChartEditorDocument): boolean {
  return document.measures.length > 0 && getInvalidMeasureIds(document).length === 0
}

export function insertEmptyMeasure(
  document: ChartEditorDocument,
  referenceMeasureId: string | null,
  position: MeasureInsertPosition,
  measureId: string,
): ChartEditorDocument {
  const referenceIndex = referenceMeasureId === null
    ? -1
    : document.measures.findIndex(measure => measure.id === referenceMeasureId)
  if (referenceMeasureId !== null && referenceIndex < 0) return document

  const reference = document.measures[referenceIndex]
  const insertionIndex = referenceIndex < 0
    ? 0
    : referenceIndex + (position === 'after' ? 1 : 0)
  const measures = [...document.measures]
  measures.splice(insertionIndex, 0, createEmptyMeasure(document, reference, measureId))

  return { ...document, measures }
}

export function deleteMeasure(
  document: ChartEditorDocument,
  measureId: string,
): ChartEditorDocument {
  const measureExists = document.measures.some(measure => measure.id === measureId)
  if (!measureExists) return document

  return {
    ...document,
    measures: document.measures.filter(measure => measure.id !== measureId),
  }
}

export function buildEditorSelection(
  document: ChartEditorDocument,
  normalizedKey: NormalizedKey,
  mood: Mood,
): ConfirmChartSelection {
  const sectionIds = [...new Set(document.measures.map(measure => measure.sectionId))]
  const sections = sectionIds.map((sectionId) => {
    const measures = document.measures.filter(measure => measure.sectionId === sectionId)
    const firstMeasure = measures[0]

    if (!firstMeasure) {
      throw new Error(`Editor section ${sectionId} has no measures`)
    }

    return {
      id: sectionId,
      label: firstMeasure.sectionLabel,
      order: firstMeasure.sectionOrder,
      measures: measures.map((measure, index) => ({
        index: index + 1,
        lyric: measure.lyric,
        chords: measure.chords.map(({ id: _id, ...placement }) => placement),
      })),
    }
  })

  return { normalizedKey, mood, sections }
}

export function addPlacement(
  document: ChartEditorDocument,
  measureId: string,
  placementId: string,
): ChartEditorDocument {
  return insertPlacement(document, measureId, null, 'after', placementId)
}

export function insertPlacement(
  document: ChartEditorDocument,
  measureId: string,
  referencePlacementId: string | null,
  position: PlacementInsertPosition,
  placementId: string,
): ChartEditorDocument {
  return updateMeasure(document, measureId, measure => ({
    ...measure,
    chords: insertPlacementNextToReference(
      measure.chords,
      referencePlacementId,
      position,
      createPlacement(placementId),
    ),
  }))
}

export function deletePlacement(
  document: ChartEditorDocument,
  placementId: string,
): ChartEditorDocument {
  const location = findPlacement(document, placementId)
  if (!location) return document

  return updateMeasure(document, location.measureId, measure => ({
    ...measure,
    chords: measure.chords.filter(placement => placement.id !== placementId),
  }))
}

export function updatePlacementChord(
  document: ChartEditorDocument,
  placementId: string,
  chord: string,
): ChartEditorDocument {
  return updatePlacement(document, placementId, placement => ({
    ...placement,
    chord,
    wasEdited: true,
  }))
}

export function updatePlacementDuration(
  document: ChartEditorDocument,
  placementId: string,
  durationBeats: number,
): ChartEditorDocument {
  return updatePlacement(document, placementId, placement => ({
    ...placement,
    durationBeats,
    wasEdited: true,
  }))
}

export function updateMeasureLyric(
  document: ChartEditorDocument,
  measureId: string,
  lyric: string,
): ChartEditorDocument {
  return updateMeasure(document, measureId, measure => ({
    ...measure,
    lyric: lyric || null,
  }))
}

export function movePlacement(
  document: ChartEditorDocument,
  placementId: string,
  targetMeasureId: string,
  targetIndex: number,
): ChartEditorDocument {
  const source = findPlacement(document, placementId)
  const target = document.measures.find(measure => measure.id === targetMeasureId)
  if (!source || !target) return document

  const placement = document.measures
    .find(measure => measure.id === source.measureId)
    ?.chords[source.placementIndex]
  if (!placement) return document

  const measures = document.measures.map((measure) => {
    if (measure.id !== source.measureId && measure.id !== targetMeasureId) return measure

    const withoutPlacement = measure.chords.filter(chord => chord.id !== placementId)
    if (measure.id !== targetMeasureId) {
      return { ...measure, chords: withoutPlacement }
    }

    const insertionIndex = Math.min(Math.max(targetIndex, 0), withoutPlacement.length)
    const chords = [...withoutPlacement]
    chords.splice(insertionIndex, 0, { ...placement, wasEdited: true })
    return { ...measure, chords }
  })

  return { ...document, measures }
}

export function moveMeasure(
  document: ChartEditorDocument,
  measureId: string,
  targetIndex: number,
): ChartEditorDocument {
  const sourceIndex = document.measures.findIndex(measure => measure.id === measureId)
  if (sourceIndex < 0) return document

  const measures = [...document.measures]
  const [measure] = measures.splice(sourceIndex, 1)
  if (!measure) return document

  const adjustedTargetIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
  const insertionIndex = Math.min(Math.max(adjustedTargetIndex, 0), measures.length)
  measures.splice(insertionIndex, 0, measure)
  return { ...document, measures }
}

function createSectionMeasures(
  section: ExtractedChart['sections'][number],
): EditorMeasure[] {
  const sourceMeasures = section.measures.map(measure => ({
    lyric: measure.lyric.value,
    sourceLyricConfidence: measure.lyric.confidence,
    chords: measure.chords.map((placement, placementIndex): EditorPlacement => ({
      id: `${section.id}:source:${measure.index}:placement:${placementIndex + 1}`,
      chord: placement.chord.value ?? '',
      durationBeats: placement.durationBeats.value ?? 0,
      lyric: placement.lyric.value,
      sourceChordConfidence: placement.chord.confidence,
      sourceDurationConfidence: placement.durationBeats.confidence,
      sourceLyricConfidence: placement.lyric.confidence,
      wasEdited: false,
    })),
  }))
  const grouped = groupMeasuresByDuration(section.id, sourceMeasures)

  return grouped.measures.map((measure, index) => ({
    id: `${section.id}:measure:${index + 1}`,
    sectionId: section.id,
    sectionLabel: section.label,
    sectionOrder: section.order,
    sourceIndex: index + 1,
    lyric: measure.lyric,
    chords: measure.chords,
  }))
}

function isValidMeasure(measure: EditorMeasure): boolean {
  if (measure.chords.length === 0) return false
  if (measure.chords.some(placement => !parseChordSymbol(placement.chord))) return false

  const totalBeats = measure.chords.reduce((total, placement) => {
    return total + placement.durationBeats
  }, 0)

  return Number.isFinite(totalBeats)
    && Math.abs(totalBeats - BEATS_PER_MEASURE) <= Number.EPSILON
}

function createPlacement(id: string): EditorPlacement {
  return {
    id,
    chord: '',
    durationBeats: 1,
    lyric: null,
    sourceChordConfidence: 'missing',
    sourceDurationConfidence: 'missing',
    sourceLyricConfidence: 'missing',
    wasEdited: true,
  }
}

function insertPlacementNextToReference(
  placements: EditorPlacement[],
  referencePlacementId: string | null,
  position: PlacementInsertPosition,
  placement: EditorPlacement,
): EditorPlacement[] {
  if (referencePlacementId === null) return [...placements, placement]

  const referenceIndex = placements.findIndex(candidate => candidate.id === referencePlacementId)
  if (referenceIndex < 0) return placements

  const insertionIndex = referenceIndex + (position === 'after' ? 1 : 0)
  const result = [...placements]
  result.splice(insertionIndex, 0, placement)
  return result
}

function createEmptyMeasure(
  document: ChartEditorDocument,
  reference: EditorMeasure | undefined,
  id: string,
): EditorMeasure {
  return {
    id,
    sectionId: reference?.sectionId ?? document.defaultSection.id,
    sectionLabel: reference?.sectionLabel ?? document.defaultSection.label,
    sectionOrder: reference?.sectionOrder ?? document.defaultSection.order,
    sourceIndex: 0,
    lyric: null,
    chords: [],
  }
}

function findPlacement(
  document: ChartEditorDocument,
  placementId: string,
): { measureId: string, placementIndex: number } | null {
  for (const measure of document.measures) {
    const placementIndex = measure.chords.findIndex(placement => placement.id === placementId)
    if (placementIndex >= 0) return { measureId: measure.id, placementIndex }
  }

  return null
}

function updatePlacement(
  document: ChartEditorDocument,
  placementId: string,
  update: (placement: EditorPlacement) => EditorPlacement,
): ChartEditorDocument {
  const location = findPlacement(document, placementId)
  if (!location) return document

  return updateMeasure(document, location.measureId, measure => ({
    ...measure,
    chords: measure.chords.map(placement =>
      placement.id === placementId ? update(placement) : placement),
  }))
}

function updateMeasure(
  document: ChartEditorDocument,
  measureId: string,
  update: (measure: EditorMeasure) => EditorMeasure,
): ChartEditorDocument {
  const measureExists = document.measures.some(measure => measure.id === measureId)
  if (!measureExists) return document

  return {
    ...document,
    measures: document.measures.map(measure =>
      measure.id === measureId ? update(measure) : measure),
  }
}
