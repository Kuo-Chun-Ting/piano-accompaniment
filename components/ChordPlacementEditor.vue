<script setup lang="ts">
import type { EditorPlacement } from '~/shared/chart-editor/types'

const props = defineProps<{
  placement: EditorPlacement
  active: boolean
  showInsertBefore: boolean
}>()

const emit = defineEmits<{
  updateChord: [value: string]
  updateDuration: [value: number]
  insertBefore: []
  insertAfter: []
  delete: []
  dragStart: [event: PointerEvent]
  activate: []
}>()

function handleChordInput(event: Event): void {
  emit('updateChord', (event.target as HTMLInputElement).value)
}

function handleDurationChange(event: Event): void {
  emit('updateDuration', Number((event.target as HTMLSelectElement).value))
}
</script>

<template>
  <div
    class="placement-editor"
    :class="{ active: props.active }"
    :data-placement-id="props.placement.id"
    data-editor-interactive
    tabindex="0"
    @pointerdown.stop="emit('activate')"
    @focusin="emit('activate')"
  >
    <button
      class="drag-surface"
      type="button"
      aria-label="Move chord"
      @pointerdown="emit('dragStart', $event)"
    />
    <button
      v-if="props.showInsertBefore"
      class="insert-button insert-before"
      type="button"
      aria-label="Insert chord before"
      @click="emit('insertBefore')"
    >
      +
    </button>
    <input
      :value="props.placement.chord"
      aria-label="Chord"
      @input="handleChordInput"
    >
    <select
      :value="props.placement.durationBeats"
      aria-label="Duration"
      @change="handleDurationChange"
    >
      <option :value="0.5">1/2</option>
      <option :value="1">1</option>
      <option :value="1.5">1.5</option>
      <option :value="2">2</option>
      <option :value="3">3</option>
      <option :value="4">4</option>
    </select>
    <button class="delete-button" type="button" aria-label="Delete chord" @click="emit('delete')">
      x
    </button>
    <button
      class="insert-button insert-after"
      type="button"
      aria-label="Insert chord after"
      @click="emit('insertAfter')"
    >
      +
    </button>
  </div>
</template>

<style scoped>
.placement-editor {
  position: relative;
  display: grid;
  min-width: 74px;
  gap: 0;
  overflow: visible;
  border: 1px solid #d2d2d7;
  border-radius: 10px;
  background: #fbfbfd;
  padding: 10px 11px 8px;
  transition: border 140ms ease, box-shadow 140ms ease, background 140ms ease;
}
.placement-editor:hover { border-color: #a6a6ab; background: #fff; }
.placement-editor.active {
  border-color: #1d1d1f;
  background: #f2f2f4;
  box-shadow: 0 0 0 3px rgba(0,0,0,.08);
}

input,
select {
  min-width: 0;
  min-height: 26px;
  border: 0;
  outline: 0;
  background: transparent;
  padding: 0;
  color: #1d1d1f;
  font: inherit;
}

input { font-size: 17px; font-weight: 590; letter-spacing: -.01em; }
select { color: #6e6e73; font-size: 11px; }

.drag-surface,
.insert-button,
.delete-button {
  position: absolute;
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms ease;
}

.placement-editor:hover .drag-surface,
.placement-editor:hover .insert-button,
.placement-editor:hover .delete-button,
.placement-editor:focus-within .drag-surface,
.placement-editor:focus-within .insert-button,
.placement-editor:focus-within .delete-button,
.placement-editor.active .drag-surface,
.placement-editor.active .insert-button,
.placement-editor.active .delete-button {
  opacity: 1;
  pointer-events: auto;
}

.drag-surface {
  inset-block-start: -10px;
  inset-inline: 22px;
  block-size: 8px;
  border: 0;
  border-radius: 999px;
  background: #a6a6ab;
  touch-action: none;
  cursor: grab;
}

.drag-surface:active { cursor: grabbing; }

.insert-button {
  z-index: 2;
  inset-block-start: 50%;
  display: grid;
  inline-size: 24px;
  block-size: 24px;
  place-items: center;
  border: 1px solid rgba(0,0,0,.12);
  border-radius: 7px;
  background: #fff;
  color: #1d1d1f;
  font-size: .9rem;
  cursor: pointer;
  transform: translateY(-50%);
}

.insert-before { inset-inline-start: -17px; }
.insert-after { inset-inline-end: -17px; }

.delete-button {
  inset-block-start: -12px;
  inset-inline-end: -5px;
  width: 25px;
  height: 22px;
  border: 1px solid rgba(0,0,0,.12);
  border-radius: 7px;
  background: rgba(255,255,255,.96);
  padding: 0;
  color: #ff3b30;
  box-shadow: 0 5px 14px rgba(0,0,0,.12);
  cursor: pointer;
}
</style>
