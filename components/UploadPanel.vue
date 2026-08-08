<script setup lang="ts">
import type { ChartReadingModelOption } from '~/shared/chart-reading/models'

const props = defineProps<{
  fileNames: string[]
  modelOptions: ChartReadingModelOption[]
  selectedModel: string
  isParsing: boolean
  canAnalyze: boolean
  statusText: string | null
  errorMessage: string | null
}>()

const emit = defineEmits<{
  filesSelected: [files: File[]]
  modelChanged: [model: string]
  analyze: []
  stop: []
  clear: []
}>()

const hasFiles = computed(() => props.fileNames.length > 0)

function handleFileChange(event: Event): void {
  const input = event.target as HTMLInputElement
  emit('filesSelected', Array.from(input.files || []))
  input.value = ''
}
</script>

<template>
  <div class="upload-panel">
    <label class="drop-zone">
      <input type="file" accept="image/*" multiple @change="handleFileChange">
      <span class="upload-icon">↑</span>
      <strong>{{ hasFiles ? 'Change images' : 'Choose chart images' }}</strong>
      <span v-if="!hasFiles">JPG or PNG</span>
      <ul v-else class="file-names" aria-label="Selected files">
        <li v-for="fileName in props.fileNames" :key="fileName" :title="fileName">
          {{ fileName }}
        </li>
      </ul>
    </label>

    <div class="analysis-controls">
      <label class="model-control">
        <span>Model</span>
        <select
          aria-label="Analysis model"
          :value="props.selectedModel"
          :disabled="props.isParsing"
          @change="emit('modelChanged', ($event.target as HTMLSelectElement).value)"
        >
          <option
            v-for="option in props.modelOptions"
            :key="option.model"
            :value="option.model"
          >
            {{ option.label }}
          </option>
        </select>
      </label>
      <span v-if="props.statusText" class="status">{{ props.statusText }}</span>
      <button
        v-if="!props.isParsing"
        class="analyze-button"
        type="button"
        :disabled="!props.canAnalyze"
        @click="emit('analyze')"
      >
        Analyze
      </button>
      <button v-else class="stop-button" type="button" @click="emit('stop')">
        Stop
      </button>
    </div>

    <p v-if="props.errorMessage" class="error">{{ props.errorMessage }}</p>
  </div>
</template>

<style scoped>
.upload-panel { display: grid; gap: 12px; }
.drop-zone {
  display: grid;
  min-height: 250px;
  place-items: center;
  align-content: center;
  gap: 8px;
  border: 1px dashed #b6b6bb;
  border-radius: 16px;
  background: rgba(255, 255, 255, .78);
  color: #1d1d1f;
  cursor: pointer;
}
input[type="file"] { position: absolute; width: 1px; height: 1px; opacity: 0; }
.upload-icon {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 11px;
  background: #f0f0f2;
  color: #1d1d1f;
  font-size: 1.35rem;
}
.drop-zone > span:last-child { color: #8e8e93; font-size: .78rem; }
.file-names {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: 5px 12px;
  margin: 0;
  padding: 0;
  color: #6e6e73;
  font-size: .76rem;
  list-style: none;
}
.file-names li { overflow: hidden; max-width: 320px; text-overflow: ellipsis; white-space: nowrap; }
.analysis-controls {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 2px;
}
.model-control {
  display: grid;
  min-width: 190px;
  gap: 5px;
}
.model-control > span {
  color: #6e6e73;
  font-size: 11px;
}
.model-control select {
  height: 36px;
  border: 1px solid rgba(0,0,0,.16);
  border-radius: 9px;
  background: rgba(255,255,255,.78);
  color: #1d1d1f;
  padding: 0 32px 0 11px;
  font: inherit;
  font-size: 13px;
}
.status {
  overflow: hidden;
  margin: 0 auto 10px 0;
  color: #6e6e73;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.analyze-button,
.stop-button {
  height: 36px;
  border-radius: 9px;
  padding: 0 16px;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.analyze-button {
  border: 0;
  background: #1d1d1f;
  color: #fff;
}
.analyze-button:disabled { background: #c7c7cc; cursor: default; }
.stop-button { border: 1px solid #d6a09a; background: #fff; color: #b23c2f; }
.error {
  margin: 0;
  border-radius: 9px;
  background: #fff0ed;
  color: #b23c2f;
  padding: 10px 12px;
  font-size: .8rem;
}
@media (max-width: 620px) {
  .analysis-controls { align-items: stretch; flex-wrap: wrap; }
  .model-control { width: 100%; }
  .status { width: 100%; margin: 0; }
  .analyze-button,
  .stop-button { flex: 1; }
}
</style>
