import { formatElapsedTime } from './elapsedTime'
export {
  CHART_READING_MODEL_OPTIONS,
  DEFAULT_CHART_READING_MODEL,
  isChartReadingModelId,
} from '../chart-reading/models'

export type ChartReadingStatusState = 'idle' | 'reading' | 'success' | 'failed'

export type ChartReadingStatus = {
  state: ChartReadingStatusState
  elapsedSeconds: number
}

export function buildChartReadingStatusText(status: ChartReadingStatus): string | null {
  if (status.state === 'idle') {
    return null
  }

  const elapsed = formatElapsedTime(status.elapsedSeconds)
  if (status.state === 'reading') {
    return `Analyzing ${elapsed}`
  }

  if (status.state === 'success') {
    return `Analyzed in ${elapsed}`
  }

  return `Failed after ${elapsed}`
}
