import OpenAI from 'openai'
import type { ExtractedChart, UploadedImage } from '../../shared/schemas/chart'
import type { ChartTaskEvent } from '../../shared/schemas/chartProcessing'
import { parseChartWorkflow } from './chartParsingWorkflow'
import type { ChartTaskClient } from './openaiChartTask'

export type ParseChartImagesInput = {
  client: ChartTaskClient
  model: string
  images: UploadedImage[]
  signal?: AbortSignal
  onEvent?: (event: ChartTaskEvent) => void
  onModelOutput?: (taskId: string, output: string) => void
}

export function createOpenAIChartClient(apiKey: string): ChartTaskClient {
  return new OpenAI({ apiKey }) as ChartTaskClient
}

export function parseChartImages(input: ParseChartImagesInput): Promise<ExtractedChart> {
  return parseChartWorkflow({
    client: input.client,
    model: input.model,
    images: input.images,
    signal: input.signal,
    onEvent: input.onEvent,
    onRawOutput: input.onModelOutput,
  })
}
