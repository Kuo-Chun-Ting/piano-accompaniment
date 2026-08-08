import type { Ref } from 'vue'
import {
  buildEditorSelection,
  canArrangeDocument,
  createChartEditorDocument,
  deleteMeasure,
  deletePlacement,
  getInvalidMeasureIds,
  insertEmptyMeasure,
  insertPlacement,
  moveMeasure,
  movePlacement,
  updateMeasureLyric,
  updatePlacementChord,
  updatePlacementDuration,
} from '~/shared/chart-editor/document'
import type {
  MeasureInsertPosition,
  PlacementInsertPosition,
} from '~/shared/chart-editor/document'
import {
  commitEditorHistory,
  createEditorHistory,
  redoEditorHistory,
  undoEditorHistory,
  type EditorHistory,
} from '~/shared/chart-editor/history'
import type { ChartEditorDocument } from '~/shared/chart-editor/types'
import type {
  ConfirmChartSelection,
  ExtractedChart,
  Mood,
  NormalizedKey,
} from '~/shared/schemas/chart'

type ChartEditorSnapshot = {
  document: ChartEditorDocument
  selectedKey: NormalizedKey
  selectedMood: Mood
}

export function useChartEditor(chart: Ref<ExtractedChart | null>) {
  const history = ref<EditorHistory<ChartEditorSnapshot> | null>(null)
  let nextPlacementId = 0
  let nextMeasureId = 0

  const document = computed(() => history.value?.present.document ?? null)
  const selectedKey = computed(() => history.value?.present.selectedKey ?? 'C')
  const selectedMood = computed(() => history.value?.present.selectedMood ?? 'spacious-ballad')
  const invalidMeasureIds = computed(() =>
    document.value ? getInvalidMeasureIds(document.value) : [])
  const canUndo = computed(() => Boolean(history.value?.past.length))
  const canRedo = computed(() => Boolean(history.value?.future.length))
  const canArrange = computed(() =>
    document.value ? canArrangeDocument(document.value) : false)

  watch(chart, reset, { immediate: true })

  onMounted(() => window.addEventListener('keydown', handleKeydown))
  onScopeDispose(() => window.removeEventListener('keydown', handleKeydown))

  function reset(nextChart: ExtractedChart | null): void {
    if (!nextChart) {
      history.value = null
      return
    }

    nextPlacementId = 0
    nextMeasureId = 0
    history.value = createEditorHistory({
      document: createChartEditorDocument(nextChart),
      selectedKey: nextChart.mode.value === 'minor' ? 'Am' : 'C',
      selectedMood: nextChart.moodRecommendation.mood,
    })
  }

  function setSelectedKey(value: NormalizedKey): void {
    commitSnapshot(snapshot => ({ ...snapshot, selectedKey: value }))
  }

  function setSelectedMood(value: Mood): void {
    commitSnapshot(snapshot => ({ ...snapshot, selectedMood: value }))
  }

  function addChord(
    measureId: string,
    referencePlacementId: string | null = null,
    position: PlacementInsertPosition = 'after',
  ): string | null {
    const placementId = `editor:new:${++nextPlacementId}`
    const changed = commitDocument(current =>
      insertPlacement(current, measureId, referencePlacementId, position, placementId))
    return changed ? placementId : null
  }

  function deleteChord(placementId: string): void {
    commitDocument(current => deletePlacement(current, placementId))
  }

  function insertMeasure(
    referenceMeasureId: string | null,
    position: MeasureInsertPosition,
  ): string | null {
    const measureId = `editor:new-measure:${++nextMeasureId}`
    const changed = commitDocument(current =>
      insertEmptyMeasure(current, referenceMeasureId, position, measureId))
    return changed ? measureId : null
  }

  function removeMeasure(measureId: string): void {
    commitDocument(current => deleteMeasure(current, measureId))
  }

  function updateChord(placementId: string, value: string): void {
    commitDocument(current => updatePlacementChord(current, placementId, value))
  }

  function updateDuration(placementId: string, value: number): void {
    commitDocument(current => updatePlacementDuration(current, placementId, value))
  }

  function updateLyric(measureId: string, value: string): void {
    commitDocument(current => updateMeasureLyric(current, measureId, value))
  }

  function moveChord(placementId: string, measureId: string, index: number): void {
    commitDocument(current => movePlacement(current, placementId, measureId, index))
  }

  function moveEditorMeasure(measureId: string, index: number): void {
    commitDocument(current => moveMeasure(current, measureId, index))
  }

  function undo(): void {
    if (history.value) history.value = undoEditorHistory(history.value)
  }

  function redo(): void {
    if (history.value) history.value = redoEditorHistory(history.value)
  }

  function buildSelection(): ConfirmChartSelection | null {
    if (!history.value || !canArrange.value) return null
    const snapshot = history.value.present
    return buildEditorSelection(snapshot.document, snapshot.selectedKey, snapshot.selectedMood)
  }

  function commitDocument(update: (document: ChartEditorDocument) => ChartEditorDocument): boolean {
    const currentHistory = history.value
    if (!currentHistory) return false
    const nextDocument = update(currentHistory.present.document)
    if (nextDocument === currentHistory.present.document) return false

    history.value = commitEditorHistory(currentHistory, {
      ...currentHistory.present,
      document: nextDocument,
    })
    return true
  }

  function commitSnapshot(update: (snapshot: ChartEditorSnapshot) => ChartEditorSnapshot): void {
    const currentHistory = history.value
    if (!currentHistory) return
    const next = update(currentHistory.present)
    if (next === currentHistory.present) return
    history.value = commitEditorHistory(currentHistory, next)
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (!history.value || !event.metaKey || event.key.toLowerCase() !== 'z') return
    event.preventDefault()
    event.shiftKey ? redo() : undo()
  }

  return {
    document,
    selectedKey,
    selectedMood,
    invalidMeasureIds,
    canArrange,
    canUndo,
    canRedo,
    setSelectedKey,
    setSelectedMood,
    addChord,
    deleteChord,
    insertMeasure,
    removeMeasure,
    updateChord,
    updateDuration,
    updateLyric,
    moveChord,
    moveMeasure: moveEditorMeasure,
    undo,
    redo,
    buildSelection,
  }
}
