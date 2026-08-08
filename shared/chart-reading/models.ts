import { z } from 'zod'

export const ChartReadingModelIdSchema = z.enum([
  'gpt-5-mini',
  'gpt-5.5',
  'gpt-5.6-sol',
])

export type ChartReadingModelId = z.infer<typeof ChartReadingModelIdSchema>

export type ChartReadingModelOption = {
  label: string
  model: ChartReadingModelId
}

export const DEFAULT_CHART_READING_MODEL: ChartReadingModelId = 'gpt-5.5'

export const CHART_READING_MODEL_OPTIONS: ChartReadingModelOption[] = [
  { label: 'gpt-5-mini', model: 'gpt-5-mini' },
  { label: 'gpt-5.5', model: 'gpt-5.5' },
  { label: 'gpt-5.6-sol', model: 'gpt-5.6-sol' },
]

const CHART_READING_MODEL_IDS = new Set<string>(
  CHART_READING_MODEL_OPTIONS.map(option => option.model),
)

export function isChartReadingModelId(value: string): value is ChartReadingModelId {
  return CHART_READING_MODEL_IDS.has(value)
}
