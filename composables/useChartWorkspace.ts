import type { ArrangementSet } from '~/shared/arrangement/types'
import { generateArrangement } from '~/shared/arrangement/generateArrangement'
import {
  DEFAULT_CHART_READING_MODEL,
  type ChartReadingModelId,
  isChartReadingModelId,
} from '~/shared/chart-reading/models'
import { getParseChartErrorMessage } from '~/shared/errors/parseChartError'
import { transposeConfirmedChart } from '~/shared/music/transposition'
import {
  parseChartWorkspaceSnapshot,
  persistChartWorkspaceSnapshot,
} from '~/shared/workspace/persistence'
import {
  buildConfirmedChart,
  type ConfirmChartSelection,
  type ConfirmedChart,
  type ExtractedChart,
  type UploadedImage,
} from '~/shared/schemas/chart'
import { decodeChartStreamBlocks } from '~/shared/schemas/chartStream'
import type { ChartReadingStatusState } from '~/shared/ui/chartReading'

export type WorkspaceError = {
  message: string
}

const CHART_WORKSPACE_STORAGE_KEY = 'piano-accompaniment.chart-workspace'

export function useChartWorkspace() {
  const uploadedImages = ref<UploadedImage[]>([])
  const extractedChart = ref<ExtractedChart | null>(null)
  const confirmedChart = ref<ConfirmedChart | null>(null)
  const arrangements = ref<ArrangementSet | null>(null)
  const isParsing = ref(false)
  const parsingElapsedSeconds = ref(0)
  const lastParsingElapsedSeconds = ref(0)
  const chartReadingStatus = ref<ChartReadingStatusState>('idle')
  const selectedModel = ref<ChartReadingModelId>(DEFAULT_CHART_READING_MODEL)
  const error = ref<WorkspaceError | null>(null)
  let parsingStartedAt = 0
  let parsingTimer: ReturnType<typeof setInterval> | null = null
  let parsingController: AbortController | null = null

  if (import.meta.client) {
    onMounted(() => {
      restoreWorkspaceSnapshot()
      watch([uploadedImages, extractedChart, confirmedChart], saveWorkspaceSnapshot, { deep: true })
    })
  }

  async function setFiles(files: File[]): Promise<void> {
    uploadedImages.value = await Promise.all(files.map(buildUploadedImage))
    extractedChart.value = null
    confirmedChart.value = null
    arrangements.value = null
    resetParsingStatus()
    error.value = null
  }

  async function parseUploadedImages(): Promise<void> {
    if (uploadedImages.value.length === 0) {
      error.value = { message: 'Choose a chart image first.' }
      return
    }

    isParsing.value = true
    startParsingTimer()
    parsingController = new AbortController()
    chartReadingStatus.value = 'reading'
    error.value = null

    try {
      const response = await fetch('/api/parse-chart', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          images: uploadedImages.value,
          model: selectedModel.value,
        }),
        signal: parsingController.signal,
      })
      if (!response.ok) {
        throw await createParseChartRequestError(response)
      }
      if (!response.body) {
        throw new Error('Chart analysis response is empty')
      }

      await readChartStream(response.body)
      finishParsing('success')
      confirmedChart.value = null
      arrangements.value = null
    } catch (caughtError) {
      if (!isAbortError(caughtError)) {
        finishParsing('failed')
        error.value = { message: getParseChartErrorMessage(caughtError) }
      } else {
        resetParsingStatus()
      }
    } finally {
      stopParsingTimer()
      isParsing.value = false
      parsingController = null
    }
  }

  function stopParsing(): void {
    if (!parsingController) {
      return
    }

    parsingController.abort()
  }

  function clearWorkspace(): void {
    resetParsingStatus()
    uploadedImages.value = []
    extractedChart.value = null
    confirmedChart.value = null
    arrangements.value = null
    isParsing.value = false
    error.value = null
    saveWorkspaceSnapshot()
  }

  function setReadingModel(model: string): void {
    if (isChartReadingModelId(model)) {
      selectedModel.value = model
    }
  }

  function confirmChart(selection: ConfirmChartSelection): void {
    if (!extractedChart.value) {
      error.value = { message: 'Read the chart before arranging.' }
      return
    }

    try {
      const confirmed = buildConfirmedChart({
        extractedChart: extractedChart.value,
        ...selection,
      })
      confirmedChart.value = transposeConfirmedChart(confirmed)
      arrangements.value = generateArrangement(confirmedChart.value)
      error.value = arrangements.value.blockingIssues.length > 0
        ? { message: arrangements.value.blockingIssues.join(' ') }
        : null
    } catch (caughtError) {
      error.value = {
        message: 'Could not arrange the score. Check chords and bar durations.',
      }
    }
  }

  onScopeDispose(stopParsingTimer)

  function startParsingTimer(): void {
    stopParsingTimer()
    parsingStartedAt = Date.now()
    parsingElapsedSeconds.value = 0
    parsingTimer = setInterval(updateParsingElapsedTime, 1000)
  }

  function updateParsingElapsedTime(): void {
    parsingElapsedSeconds.value = getCurrentParsingElapsedSeconds()
  }

  function stopParsingTimer(): void {
    if (parsingTimer === null) {
      return
    }

    clearInterval(parsingTimer)
    parsingTimer = null
  }

  function finishParsing(status: Exclude<ChartReadingStatusState, 'idle' | 'reading'>): void {
    const elapsedSeconds = getCurrentParsingElapsedSeconds()
    parsingElapsedSeconds.value = elapsedSeconds
    lastParsingElapsedSeconds.value = elapsedSeconds
    chartReadingStatus.value = status
  }

  function resetParsingStatus(): void {
    stopParsingTimer()
    chartReadingStatus.value = 'idle'
    parsingElapsedSeconds.value = 0
    lastParsingElapsedSeconds.value = 0
  }

  function getCurrentParsingElapsedSeconds(): number {
    return Math.floor((Date.now() - parsingStartedAt) / 1000)
  }

  function restoreWorkspaceSnapshot(): void {
    const snapshot = parseChartWorkspaceSnapshot(sessionStorage.getItem(CHART_WORKSPACE_STORAGE_KEY))

    if (!snapshot) {
      return
    }

    uploadedImages.value = snapshot.uploadedImages
    extractedChart.value = snapshot.extractedChart
    confirmedChart.value = snapshot.confirmedChart
    arrangements.value = snapshot.confirmedChart ? generateArrangement(snapshot.confirmedChart) : null
    error.value = arrangements.value?.blockingIssues.length
      ? { message: arrangements.value.blockingIssues.join(' ') }
      : null
  }

  function saveWorkspaceSnapshot(): void {
    try {
      persistChartWorkspaceSnapshot(sessionStorage, CHART_WORKSPACE_STORAGE_KEY, {
        uploadedImages: uploadedImages.value,
        extractedChart: extractedChart.value,
        confirmedChart: confirmedChart.value,
      })
    } catch {
      // Large image data can exceed browser storage limits; the active in-memory state remains valid.
    }
  }

  return {
    uploadedImages,
    extractedChart,
    confirmedChart,
    arrangements,
    isParsing,
    parsingElapsedSeconds,
    lastParsingElapsedSeconds,
    chartReadingStatus,
    selectedModel,
    error,
    setFiles,
    parseUploadedImages,
    stopParsing,
    setReadingModel,
    confirmChart,
    clearWorkspace,
  }

  async function readChartStream(stream: ReadableStream<Uint8Array>): Promise<void> {
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let receivedResult = false

    while (true) {
      const { value, done } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      const decoded = decodeChartStreamBlocks(buffer)
      buffer = decoded.remainder

      for (const message of decoded.messages) {
        if (message.type === 'result') {
          extractedChart.value = message.chart
          receivedResult = true
        } else if (message.type === 'error') {
          throw new Error(message.message)
        }
      }

      if (done) {
        break
      }
    }

    if (!receivedResult) {
      throw new Error('Chart reading ended without a result')
    }
  }
}

async function buildUploadedImage(file: File, order: number): Promise<UploadedImage> {
  return {
    filename: file.name,
    order,
    dataUrl: await compressImageToDataUrl(file),
  }
}

async function compressImageToDataUrl(file: File): Promise<string> {
  const image = await loadImage(file)
  const canvas = document.createElement('canvas')
  const maxWidth = 1800
  const scale = Math.min(1, maxWidth / image.width)
  canvas.width = Math.round(image.width * scale)
  canvas.height = Math.round(image.height * scale)

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas context is unavailable')
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.9)
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Image failed to load'))
    }
    image.src = objectUrl
  })
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

async function createParseChartRequestError(response: Response): Promise<Error> {
  const body = await response.text()

  return new Error(readParseChartRequestErrorMessage(body, response.statusText))
}

function readParseChartRequestErrorMessage(body: string, fallback: string): string {
  try {
    const error = JSON.parse(body) as { message?: unknown, statusMessage?: unknown }

    if (typeof error.statusMessage === 'string') {
      return error.statusMessage
    }
    if (typeof error.message === 'string') {
      return error.message
    }
  } catch {
    // Non-JSON error bodies fall back to their response text.
  }

  return body || fallback
}
