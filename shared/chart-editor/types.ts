import type { ConfirmedChordPlacement } from '../schemas/chart'

export type EditorPlacement = ConfirmedChordPlacement & {
  id: string
}

export type EditorMeasure = {
  id: string
  sectionId: string
  sectionLabel: string
  sectionOrder: number
  sourceIndex: number
  lyric: string | null
  chords: EditorPlacement[]
}

export type EditorSection = {
  id: string
  label: string
  order: number
}

export type ChartEditorDocument = {
  measures: EditorMeasure[]
  defaultSection: EditorSection
}

export type PlacementLocation = {
  measureId: string
  placementIndex: number
}
