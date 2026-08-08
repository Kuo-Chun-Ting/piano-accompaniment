type DropSide = 'before' | 'after'

type ChordDragState = {
  kind: 'chord'
  placementId: string
  pointerId: number
  targetMeasureId: string | null
  targetIndex: number
  targetPlacementId: string | null
  targetSide: DropSide
}

type MeasureDragState = {
  kind: 'measure'
  measureId: string
  pointerId: number
  targetIndex: number
  targetMeasureId: string | null
  targetSide: DropSide
}

type DragState = ChordDragState | MeasureDragState
type ChartEditor = ReturnType<typeof useChartEditor>

export function useChartEditorDrag(
  editor: ChartEditor,
  activatePlacement: (placementId: string) => void,
  activateMeasure: (measureId: string) => void,
) {
  const dragState = ref<DragState | null>(null)

  onScopeDispose(removeDragListeners)

  function startChordDrag(placementId: string, event: PointerEvent): void {
    event.preventDefault()
    activatePlacement(placementId)
    dragState.value = {
      kind: 'chord',
      placementId,
      pointerId: event.pointerId,
      targetMeasureId: null,
      targetIndex: 0,
      targetPlacementId: null,
      targetSide: 'after',
    }
    addDragListeners()
  }

  function startMeasureDrag(measureId: string, event: PointerEvent): void {
    event.preventDefault()
    activateMeasure(measureId)
    dragState.value = {
      kind: 'measure',
      measureId,
      pointerId: event.pointerId,
      targetIndex: 0,
      targetMeasureId: null,
      targetSide: 'after',
    }
    addDragListeners()
  }

  function handlePointerMove(event: PointerEvent): void {
    const state = dragState.value
    if (!state || state.pointerId !== event.pointerId) {
      return
    }

    if (state.kind === 'chord') {
      updateChordDropTarget(state, event)
    } else {
      updateMeasureDropTarget(state, event)
    }
  }

  function updateChordDropTarget(state: ChordDragState, event: PointerEvent): void {
    const target = window.document.elementFromPoint(event.clientX, event.clientY)
    const measureElement = target?.closest<HTMLElement>('[data-drop-measure]')
    const measureId = measureElement?.dataset.dropMeasure
    const measure = editor.document.value?.measures.find(candidate => candidate.id === measureId)
    if (!measure || !measureId) {
      state.targetMeasureId = null
      return
    }

    const placementElement = target?.closest<HTMLElement>('[data-drop-placement]')
    if (!placementElement) {
      const lastPlacement = measure.chords.at(-1)
      state.targetMeasureId = measureId
      state.targetIndex = measure.chords.length
      state.targetPlacementId = lastPlacement?.id ?? null
      state.targetSide = 'after'
      return
    }

    const placementIndex = Number(placementElement.dataset.dropIndex)
    const rect = placementElement.getBoundingClientRect()
    const targetSide = event.clientX < rect.left + rect.width / 2 ? 'before' : 'after'
    const insertionIndex = placementIndex + (targetSide === 'after' ? 1 : 0)
    const sourceMeasure = editor.document.value?.measures.find(candidate =>
      candidate.chords.some(placement => placement.id === state.placementId))
    const sourceIndex = sourceMeasure?.chords.findIndex(
      placement => placement.id === state.placementId,
    ) ?? -1

    state.targetMeasureId = measureId
    state.targetIndex = sourceMeasure?.id === measureId && sourceIndex < insertionIndex
      ? insertionIndex - 1
      : insertionIndex
    state.targetPlacementId = placementElement.dataset.dropPlacement ?? null
    state.targetSide = targetSide
  }

  function updateMeasureDropTarget(state: MeasureDragState, event: PointerEvent): void {
    const target = window.document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-measure-id]')
    const measureId = target?.dataset.measureId
    const measureIndex = editor.document.value?.measures
      .findIndex(measure => measure.id === measureId) ?? -1
    if (!target || !measureId || measureIndex < 0 || measureId === state.measureId) {
      state.targetMeasureId = null
      return
    }

    const rect = target.getBoundingClientRect()
    const targetSide = event.clientX < rect.left + rect.width / 2 ? 'before' : 'after'
    state.targetMeasureId = measureId
    state.targetIndex = measureIndex + (targetSide === 'after' ? 1 : 0)
    state.targetSide = targetSide
  }

  function handlePointerUp(event: PointerEvent): void {
    handlePointerMove(event)
    const state = dragState.value
    if (state?.kind === 'chord' && state.targetMeasureId) {
      editor.moveChord(state.placementId, state.targetMeasureId, state.targetIndex)
    } else if (state?.kind === 'measure' && state.targetMeasureId) {
      editor.moveMeasure(state.measureId, state.targetIndex)
    }
    cancelDrag()
  }

  function cancelDrag(): void {
    dragState.value = null
    removeDragListeners()
  }

  function addDragListeners(): void {
    removeDragListeners()
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', cancelDrag)
  }

  function removeDragListeners(): void {
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', handlePointerUp)
    window.removeEventListener('pointercancel', cancelDrag)
  }

  function isChordDropTarget(
    measureId: string,
    placementId: string,
    side: DropSide,
  ): boolean {
    const state = dragState.value
    return state?.kind === 'chord'
      && state.targetMeasureId === measureId
      && state.targetPlacementId === placementId
      && state.targetSide === side
  }

  function isEmptyChordDropTarget(measureId: string): boolean {
    const state = dragState.value
    return state?.kind === 'chord'
      && state.targetMeasureId === measureId
      && state.targetPlacementId === null
  }

  function isMeasureDropTarget(measureId: string, side: DropSide): boolean {
    const state = dragState.value
    return state?.kind === 'measure'
      && state.targetMeasureId === measureId
      && state.targetSide === side
  }

  return {
    dragState,
    startChordDrag,
    startMeasureDrag,
    isChordDropTarget,
    isEmptyChordDropTarget,
    isMeasureDropTarget,
  }
}
