<script setup lang="ts">
import type { EditorMeasure } from '~/shared/chart-editor/types'
import type {
  ConfirmChartSelection,
  ExtractedChart,
  Mood,
  NormalizedKey,
} from '~/shared/schemas/chart'
import {
  buildPlacementGridTemplate,
  getMeasureBeatState,
} from '~/shared/ui/chartReview'

type DropSide = 'before' | 'after'

const props = defineProps<{
  chart: ExtractedChart
}>()

const emit = defineEmits<{
  confirm: [selection: ConfirmChartSelection]
}>()

const editor = useChartEditor(toRef(props, 'chart'))
const activePlacementId = ref<string | null>(null)
const activeMeasureId = ref<string | null>(null)
const invalidMeasureIds = computed(() => new Set(editor.invalidMeasureIds.value))
const {
  dragState,
  startChordDrag,
  startMeasureDrag,
  isChordDropTarget,
  isEmptyChordDropTarget,
  isMeasureDropTarget,
} = useChartEditorDrag(editor, activatePlacement, activateMeasure)

const moodOptions: Array<{ value: Mood, label: string }> = [
  { value: 'spacious-ballad', label: 'Sparse Ballad' },
  { value: 'flowing-narrative', label: 'Flowing Arpeggio' },
  { value: 'urban-groove', label: 'Groove Comping' },
]

onMounted(() => window.addEventListener('pointerdown', clearInactiveControls))
onScopeDispose(() => window.removeEventListener('pointerdown', clearInactiveControls))

function confirmChart(): void {
  const selection = editor.buildSelection()
  if (selection) {
    emit('confirm', selection)
  }
}

function updateSelectedMood(event: Event): void {
  editor.setSelectedMood((event.target as HTMLSelectElement).value as Mood)
}

function updateSelectedKey(event: Event): void {
  editor.setSelectedKey((event.target as HTMLSelectElement).value as NormalizedKey)
}

async function addChord(
  measureId: string,
  referencePlacementId: string | null = null,
  position: DropSide = 'after',
): Promise<void> {
  const placementId = editor.addChord(measureId, referencePlacementId, position)
  if (!placementId) {
    return
  }

  activatePlacement(placementId)
  await nextTick()
  window.document
    .querySelector<HTMLInputElement>(`[data-placement-id="${placementId}"] input`)
    ?.focus()
}

function insertMeasure(
  referenceMeasureId: string | null,
  position: DropSide,
): void {
  const measureId = editor.insertMeasure(referenceMeasureId, position)
  if (!measureId) {
    return
  }

  activePlacementId.value = null
  activeMeasureId.value = measureId
}

function deleteMeasure(measureId: string): void {
  editor.removeMeasure(measureId)
  activeMeasureId.value = null
  activePlacementId.value = null
}

function deleteChord(placementId: string): void {
  editor.deleteChord(placementId)
  if (activePlacementId.value === placementId) {
    activePlacementId.value = null
  }
}

function activatePlacement(placementId: string): void {
  activePlacementId.value = placementId
  activeMeasureId.value = null
}

function activateMeasure(measureId: string): void {
  activeMeasureId.value = measureId
  activePlacementId.value = null
}

function clearInactiveControls(event: PointerEvent): void {
  const target = event.target
  if (target instanceof Element && target.closest('[data-editor-interactive]')) {
    return
  }

  activePlacementId.value = null
  activeMeasureId.value = null
}

function measureTotal(measure: EditorMeasure): number {
  return getMeasureBeatState(measure.chords).total
}
</script>

<template>
  <div v-if="editor.document.value" class="chart-editor">
    <header class="editor-toolbar">
      <strong>Chart</strong>

      <div class="editor-actions">
        <div class="history-controls">
          <button
            type="button"
            data-tooltip="Undo ⌘Z"
            aria-label="Undo"
            :disabled="!editor.canUndo.value"
            @click="editor.undo"
          >
            ↶
          </button>
          <button
            type="button"
            data-tooltip="Redo ⇧⌘Z"
            aria-label="Redo"
            :disabled="!editor.canRedo.value"
            @click="editor.redo"
          >
            ↷
          </button>
        </div>
        <button
          class="create-score-button"
          type="button"
          :disabled="!editor.canArrange.value"
          @click="confirmChart"
        >
          Create Piano Score
        </button>
      </div>
    </header>

    <div class="chart-settings">
      <label :title="`Original key: ${props.chart.originalKey.value || 'Unknown'}`">
        <span>Key</span>
        <select :value="editor.selectedKey.value" @change="updateSelectedKey">
          <option value="C">C</option>
          <option value="Am">Am</option>
        </select>
      </label>
      <label class="style-control">
        <span>Style</span>
        <select
          aria-label="Style"
          :value="editor.selectedMood.value"
          @change="updateSelectedMood"
        >
          <option v-for="option in moodOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>
      <label>
        <span>Tempo</span>
        <strong>{{ props.chart.tempo.value ? `${props.chart.tempo.value} BPM` : '—' }}</strong>
      </label>
      <label>
        <span>Time</span>
        <strong>4 / 4</strong>
      </label>
    </div>

    <div
      class="measure-grid"
      data-workspace-scroll
      :class="{
        'dragging-chord': dragState?.kind === 'chord',
        'dragging-measure': dragState?.kind === 'measure',
      }"
    >
      <div
        v-for="(measure, measureIndex) in editor.document.value.measures"
        :key="measure.id"
        class="measure"
        :class="{
          active: activeMeasureId === measure.id,
          invalid: invalidMeasureIds.has(measure.id),
          'dragging-source': dragState?.kind === 'measure' && dragState.measureId === measure.id,
          'drop-before': isMeasureDropTarget(measure.id, 'before'),
          'drop-after': isMeasureDropTarget(measure.id, 'after'),
        }"
        :data-drop-measure="measure.id"
        :data-measure-id="measure.id"
        data-editor-interactive
        tabindex="0"
        @pointerdown="activateMeasure(measure.id)"
        @focusin.self="activateMeasure(measure.id)"
      >
        <button
          class="measure-drag-surface"
          type="button"
          aria-label="Move measure"
          @pointerdown.stop="startMeasureDrag(measure.id, $event)"
        />
        <button
          v-if="measureIndex === 0"
          class="measure-insert insert-before"
          type="button"
          aria-label="Insert measure before"
          @pointerdown.stop
          @click.stop="insertMeasure(measure.id, 'before')"
        >
          +
        </button>
        <button
          class="delete-measure"
          type="button"
          aria-label="Delete measure"
          @pointerdown.stop
          @click.stop="deleteMeasure(measure.id)"
        >
          ×
        </button>
        <button
          class="measure-insert insert-after"
          type="button"
          aria-label="Insert measure after"
          @pointerdown.stop
          @click.stop="insertMeasure(measure.id, 'after')"
        >
          +
        </button>
        <span class="measure-total">{{ measureTotal(measure) }} / 4</span>

        <div
          class="placements"
          :class="{ 'drop-empty': isEmptyChordDropTarget(measure.id) }"
          :style="{ gridTemplateColumns: buildPlacementGridTemplate(measure.chords) }"
          :data-drop-measure="measure.id"
        >
          <div
            v-for="(placement, placementIndex) in measure.chords"
            :key="placement.id"
            class="placement-slot"
            :class="{
              'dragging-source': dragState?.kind === 'chord'
                && dragState.placementId === placement.id,
              'drop-before': isChordDropTarget(measure.id, placement.id, 'before'),
              'drop-after': isChordDropTarget(measure.id, placement.id, 'after'),
            }"
            :data-drop-placement="placement.id"
            :data-drop-index="placementIndex"
          >
            <ChordPlacementEditor
              :placement="placement"
              :active="activePlacementId === placement.id"
              :show-insert-before="placementIndex === 0"
              @update-chord="editor.updateChord(placement.id, $event)"
              @update-duration="editor.updateDuration(placement.id, $event)"
              @insert-before="addChord(measure.id, placement.id, 'before')"
              @insert-after="addChord(measure.id, placement.id, 'after')"
              @delete="deleteChord(placement.id)"
              @drag-start="startChordDrag(placement.id, $event)"
              @activate="activatePlacement(placement.id)"
            />
          </div>
        </div>

        <button
          v-if="measure.chords.length === 0"
          class="add-chord"
          type="button"
          aria-label="Add chord"
          @click="addChord(measure.id)"
        >
          +
        </button>
        <input
          class="lyric-input"
          :value="measure.lyric || ''"
          aria-label="Lyrics"
          @input="editor.updateLyric(measure.id, ($event.target as HTMLInputElement).value)"
        >
      </div>

      <div v-if="editor.document.value.measures.length === 0" class="empty-measures">
        <button type="button" aria-label="Add measure" @click="insertMeasure(null, 'after')">
          +
        </button>
      </div>
    </div>

  </div>
</template>

<style scoped>
.chart-editor {
  display: grid;
  height: 100%;
  min-width: 0;
  min-height: 0;
  grid-template-rows: 52px 58px minmax(0, 1fr);
  overflow: hidden;
  background: rgba(255,255,255,.82);
}
.editor-toolbar {
  display: flex;
  height: 52px;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(0,0,0,.09);
  background: rgba(250,250,252,.86);
  padding: 8px 16px;
}
.editor-toolbar > strong { font-weight: 620; }
.editor-actions,
.history-controls { display: flex; gap: 2px; }
.editor-actions { align-items: center; gap: 8px; }
.create-score-button {
  min-height: 32px;
  border: 0;
  border-radius: 8px;
  background: #1d1d1f;
  color: #fff;
  padding: 0 13px;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.create-score-button:disabled { background: #c7c7cc; cursor: default; }
.history-controls button {
  position: relative;
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #515154;
  font-size: 16px;
  cursor: pointer;
}
.history-controls button:hover:not(:disabled) { background: rgba(0,0,0,.055); }
.history-controls button:disabled { color: #c7c7cc; cursor: default; }
.history-controls button::after {
  position: absolute;
  z-index: 20;
  top: calc(100% + 7px);
  left: 50%;
  padding: 5px 8px;
  border-radius: 6px;
  background: rgba(36,36,38,.94);
  color: #fff;
  content: attr(data-tooltip);
  font-size: 11px;
  line-height: 1;
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, -3px);
  transition: opacity 120ms ease, transform 120ms ease;
  white-space: nowrap;
}
.history-controls button:hover::after,
.history-controls button:focus-visible::after { opacity: 1; transform: translate(-50%, 0); }
.chart-settings {
  display: flex;
  align-items: center;
  gap: 26px;
  border-bottom: 1px solid rgba(0,0,0,.09);
  background: #f5f5f7;
  padding: 9px 16px;
}
.chart-settings label {
  display: flex;
  min-width: 110px;
  align-items: baseline;
  gap: 3px;
  padding: 0;
}
.chart-settings .style-control { min-width: 180px; }
.chart-settings label > span { min-width: 42px; color: #6e6e73; font-size: 11px; }
.chart-settings select,
.chart-settings strong {
  width: auto;
  min-width: 0;
  min-height: 22px;
  border: 0;
  outline: 0;
  background: transparent;
  color: #1d1d1f;
  padding: 0;
  font: inherit;
  font-size: 13px;
  font-weight: 580;
}
.chart-settings select { min-width: 48px; }
.chart-settings .style-control select { min-width: 126px; }
.measure-grid {
  display: grid;
  min-height: 0;
  box-sizing: border-box;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  overflow-x: hidden;
  overflow-y: auto;
  background: #fff;
  padding-inline: 13px;
}
.measure {
  position: relative;
  display: grid;
  min-height: 174px;
  align-content: start;
  gap: 12px;
  border-right: 1px solid rgba(0,0,0,.09);
  border-bottom: 1px solid rgba(0,0,0,.09);
  background: #fff;
  padding: 38px 16px 16px;
}
.measure:nth-child(2n) { border-right: 0; }
.measure.invalid { box-shadow: inset 0 0 0 1px #ff3b30; }
.measure-total {
  position: absolute;
  inset-block-start: 14px;
  inset-inline-end: 16px;
  color: #6e6e73;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.placements { display: grid; min-height: 74px; align-items: start; gap: 8px; }
.placement-slot { position: relative; min-width: 0; }
.measure.dragging-source,
.placement-slot.dragging-source { opacity: .4; }
.measure.drop-before::before,
.measure.drop-after::after,
.placement-slot.drop-before::before,
.placement-slot.drop-after::after {
  position: absolute;
  z-index: 4;
  width: 3px;
  border-radius: 999px;
  background: #1d1d1f;
  content: "";
}
.measure.drop-before::before,
.measure.drop-after::after { inset-block: 8px; }
.measure.drop-before::before { inset-inline-start: -7px; }
.measure.drop-after::after { inset-inline-end: -7px; }
.placement-slot.drop-before::before,
.placement-slot.drop-after::after { inset-block: 18px 6px; }
.placement-slot.drop-before::before { inset-inline-start: -10px; }
.placement-slot.drop-after::after { inset-inline-end: -10px; }
.placements.drop-empty { border-radius: 10px; box-shadow: inset 0 0 0 2px #1d1d1f; }
.measure-insert,
.delete-measure,
.measure-drag-surface {
  position: absolute;
  z-index: 3;
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms ease;
}
.measure:hover > .measure-insert,
.measure:hover > .delete-measure,
.measure:hover > .measure-drag-surface,
.measure:focus-within > .measure-insert,
.measure:focus-within > .delete-measure,
.measure:focus-within > .measure-drag-surface,
.measure.active > .measure-insert,
.measure.active > .delete-measure,
.measure.active > .measure-drag-surface {
  opacity: 1;
  pointer-events: auto;
}
.measure-insert {
  inset-block-end: 16px;
  display: grid;
  width: 26px;
  height: 30px;
  place-items: center;
  border: 0;
  border-radius: 7px;
  background: #1d1d1f;
  color: #fff;
  cursor: pointer;
}
.insert-before { inset-inline-start: -13px; }
.insert-after { inset-inline-end: -13px; }
.delete-measure {
  inset-block-start: 5px;
  inset-inline-end: 6px;
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 50%;
  background: #f2f2f4;
  color: #636366;
  cursor: pointer;
}
.measure-drag-surface {
  inset-block-start: 10px;
  inset-inline: 48px;
  height: 8px;
  border: 0;
  border-radius: 999px;
  background: #d8d8dc;
  touch-action: none;
  cursor: grab;
}
.add-chord,
.empty-measures button {
  display: grid;
  place-items: center;
  border: 1px solid #c7c7cc;
  background: #fff;
  color: #1d1d1f;
  cursor: pointer;
}
.add-chord { width: 30px; height: 28px; border-radius: 7px; }
.empty-measures { display: grid; min-height: 150px; grid-column: 1 / -1; place-items: center; }
.empty-measures button { width: 42px; height: 42px; border-radius: 50%; font-size: 1.2rem; }
.lyric-input {
  width: 100%;
  box-sizing: border-box;
  border-width: 0 0 1px;
  border-color: #c7c7cc;
  border-radius: 0;
  background: transparent;
  outline: 0;
  padding: 4px 1px 7px;
  font: inherit;
}
.lyric-input:focus { border-color: #1d1d1f; }
@media (max-width: 620px) {
  .chart-editor { height: auto; min-height: 720px; grid-template-rows: auto auto auto; }
  .chart-settings { align-items: flex-start; flex-wrap: wrap; gap: 8px 18px; }
  .measure-grid { grid-template-columns: 1fr; max-height: none; }
  .measure { border-right: 0; }
}
</style>
