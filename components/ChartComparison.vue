<script setup lang="ts">
import type { UploadedImage } from '~/shared/schemas/chart'
import { adjustImageZoom, clampPanePercent } from '~/shared/ui/comparisonControls'

const props = defineProps<{
  images: UploadedImage[]
  contentId: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  filesSelected: [files: File[]]
  clear: []
}>()

const activeImageIndex = ref(0)
const imageZoom = ref(1)
const panePercent = ref(42)
const analysisPane = ref<HTMLElement | null>(null)

const activeImage = computed(() => props.images[activeImageIndex.value] || null)
const comparisonStyle = computed(() => ({
  '--image-zoom': imageZoom.value,
  '--left-pane': `${panePercent.value}fr`,
  '--right-pane': `${100 - panePercent.value}fr`,
}))

watch(
  () => props.images,
  () => {
    activeImageIndex.value = 0
  },
)

watch(
  () => props.contentId,
  async () => {
    await nextTick()
    analysisPane.value?.scrollTo({ top: 0, left: 0 })
    analysisPane.value
      ?.querySelectorAll<HTMLElement>('[data-workspace-scroll]')
      .forEach(element => element.scrollTo({ top: 0, left: 0 }))
  },
)

function selectImage(index: number): void {
  activeImageIndex.value = index
}

function handleFileChange(event: Event): void {
  const input = event.target as HTMLInputElement
  emit('filesSelected', Array.from(input.files || []))
  input.value = ''
}

function changeImageZoom(delta: number): void {
  imageZoom.value = adjustImageZoom(imageZoom.value, delta)
}

function resetImageZoom(): void {
  imageZoom.value = 1
}

function startResize(event: PointerEvent): void {
  const handle = event.currentTarget as HTMLElement
  handle.setPointerCapture(event.pointerId)
}

function resizePanes(event: PointerEvent): void {
  const handle = event.currentTarget as HTMLElement
  if (!handle.hasPointerCapture(event.pointerId)) {
    return
  }

  const container = handle.parentElement
  if (!container) {
    return
  }

  const bounds = container.getBoundingClientRect()
  const requestedPercent = ((event.clientX - bounds.left) / bounds.width) * 100
  panePercent.value = clampPanePercent(requestedPercent)
}

function stopResize(event: PointerEvent): void {
  const handle = event.currentTarget as HTMLElement
  if (handle.hasPointerCapture(event.pointerId)) {
    handle.releasePointerCapture(event.pointerId)
  }
}

function resetPanePercent(): void {
  panePercent.value = 50
}
</script>

<template>
  <div class="comparison" :style="comparisonStyle">
    <aside class="reference-pane">
      <header class="pane-toolbar">
        <div class="source-title">
          <strong>Source</strong>
          <span v-if="activeImage" :title="activeImage.filename">{{ activeImage.filename }}</span>
        </div>
        <div class="source-actions">
          <nav v-if="props.images.length > 1" class="image-tabs" aria-label="Chart images">
            <button
              v-for="(_image, index) in props.images"
              :key="index"
              type="button"
              :class="{ active: index === activeImageIndex }"
              @click="selectImage(index)"
            >
              {{ index + 1 }}
            </button>
          </nav>
          <label class="replace-button">
            <input
              type="file"
              accept="image/*"
              multiple
              :disabled="props.disabled"
              @change="handleFileChange"
            >
            Replace
          </label>
          <button
            class="clear-button"
            type="button"
            :disabled="props.disabled"
            @click="emit('clear')"
          >
            Clear
          </button>
          <div class="zoom-controls">
            <button type="button" aria-label="Zoom out" @click="changeImageZoom(-0.25)">−</button>
            <button type="button" @click="resetImageZoom">{{ Math.round(imageZoom * 100) }}%</button>
            <button type="button" aria-label="Zoom in" @click="changeImageZoom(0.25)">＋</button>
          </div>
        </div>
      </header>

      <div v-if="activeImage" class="image-stage">
        <img :src="activeImage.dataUrl" :alt="`Uploaded chart ${activeImageIndex + 1}`" draggable="false">
      </div>
      <p v-else class="image-empty">Image unavailable</p>
    </aside>

    <button
      class="resize-handle"
      type="button"
      aria-label="Resize panes"
      @pointerdown="startResize"
      @pointermove="resizePanes"
      @pointerup="stopResize"
      @pointercancel="stopResize"
      @dblclick="resetPanePercent"
    />

    <div ref="analysisPane" class="analysis-pane">
      <div class="analysis-canvas">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.comparison {
  display: grid;
  grid-template-columns: minmax(360px, var(--left-pane)) 8px minmax(520px, var(--right-pane));
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, .09);
  border-radius: 16px;
  background: rgba(255,255,255,.86);
  box-shadow: 0 18px 60px rgba(0,0,0,.08);
}
.reference-pane {
  position: relative;
  display: grid;
  grid-template-rows: 52px minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border-right: 1px solid rgba(0,0,0,.04);
  background: #e9e9eb;
}
.pane-toolbar {
  display: flex;
  height: 52px;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(0,0,0,.09);
  background: rgba(250,250,252,.86);
  padding: 8px 13px;
}
.source-title {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 9px;
}
.source-title strong { flex: 0 0 auto; font-weight: 620; }
.source-title span {
  overflow: hidden;
  color: #6e6e73;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.source-actions,
.image-tabs,
.zoom-controls { display: flex; align-items: center; }
.source-actions { gap: 8px; }
.replace-button,
.clear-button {
  display: inline-flex;
  height: 30px;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(0,0,0,.14);
  border-radius: 7px;
  background: rgba(255,255,255,.7);
  color: #3a3a3c;
  padding: 0 9px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.replace-button input { position: absolute; width: 1px; height: 1px; opacity: 0; }
.replace-button:has(input:disabled),
.clear-button:disabled { color: #aeaeb2; cursor: default; }
.image-tabs { gap: 3px; }
.image-tabs button { min-width: 28px; height: 28px; border: 0; border-radius: 6px; background: transparent; color: #636366; cursor: pointer; }
.image-tabs button.active { border-color: #1d1d1f; background: #1d1d1f; color: white; }
.image-stage {
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: auto;
  padding: 22px;
}
.image-stage img {
  display: block;
  width: calc(100% * var(--image-zoom));
  height: auto;
  max-width: none;
  border-radius: 3px;
  background: white;
  box-shadow: 0 10px 30px rgba(0,0,0,.13);
  user-select: none;
}
.zoom-controls { gap: 2px; }
.zoom-controls button { min-width: 30px; height: 30px; border: 0; border-radius: 7px; background: transparent; color: #515154; cursor: pointer; }
.zoom-controls button:nth-child(2) { min-width: 48px; color: #6e6e73; font-size: 12px; }
.zoom-controls button:hover { background: rgba(0,0,0,.055); }
.image-empty { display: grid; min-height: 100%; place-items: center; margin: 0; color: #748078; }
.resize-handle { position: relative; z-index: 4; width: 8px; border: 0; border-inline: 1px solid rgba(0,0,0,.08); background: #f5f5f7; cursor: col-resize; touch-action: none; }
.resize-handle::after { content: ""; position: absolute; top: 50%; left: 50%; width: 3px; height: 44px; border-radius: 999px; background: #aeaeb2; transform: translate(-50%, -50%); }
.resize-handle:hover::after { background: #1d1d1f; }
.analysis-pane { min-width: 0; min-height: 0; overflow: hidden; background: rgba(255,255,255,.82); }
.analysis-canvas { width: 100%; height: 100%; min-height: 0; }
.analysis-canvas > :deep(*) { height: 100%; }
@media (max-width: 920px) {
  .comparison {
    height: auto;
    grid-template-columns: 1fr !important;
    grid-template-rows: minmax(300px, 412px) minmax(420px, auto);
    min-height: 0;
  }
  .resize-handle { display: none; }
  .reference-pane, .analysis-pane { min-height: 0; }
  .reference-pane { grid-template-rows: 52px 360px; }
  .image-stage { height: 100%; }
  .analysis-pane { overflow: visible; }
}
</style>
