import type { z } from 'zod'
import type { ExtractedChart, UploadedImage } from '../../shared/schemas/chart'
import type { ChartTaskEvent } from '../../shared/schemas/chartProcessing'
import { buildReadingChartTask } from './chartTaskPrompts'
import { expandCompactChartResponse } from './compactChartResponse'
import {
  runChartTask,
  type ChartTaskClient,
  type RunChartTaskInput,
} from './openaiChartTask'

export type ChartWorkflowTaskRunner = <Schema extends z.ZodType>(
  input: RunChartTaskInput<Schema>,
) => Promise<z.infer<Schema>>

export type ParseChartWorkflowInput = {
  client: ChartTaskClient
  model: string
  images: UploadedImage[]
  signal?: AbortSignal
  taskRunner?: ChartWorkflowTaskRunner
  now?: () => number
  onEvent?: (event: ChartTaskEvent) => void
  onRawOutput?: (taskId: string, output: string) => void
}

export async function parseChartWorkflow(
  input: ParseChartWorkflowInput,
): Promise<ExtractedChart> {
  const now = input.now ?? (() => performance.now())
  const startedAt = now()
  throwIfAborted(input.signal)

  try {
    const runner = input.taskRunner ?? runChartTask
    const response = await executeTask(input, runner, buildReadingChartTask())
    const chart = expandCompactChartResponse(response)

    const completedAt = now()
    input.onEvent?.({
      type: 'job-completed',
      timestamp: completedAt,
      totalDurationMs: completedAt - startedAt,
    })
    return chart
  } catch (error) {
    reportStoppedJob(input, now, startedAt, error)
    throw error
  }
}

function executeTask<Schema extends z.ZodType>(
  input: ParseChartWorkflowInput,
  runner: ChartWorkflowTaskRunner,
  task: RunChartTaskInput<Schema>['task'],
): Promise<z.infer<Schema>> {
  throwIfAborted(input.signal)
  return runner({
    client: input.client,
    model: input.model,
    task,
    images: input.images,
    signal: input.signal,
    now: input.now,
    onEvent: input.onEvent,
    onRawOutput: input.onRawOutput,
  })
}

function reportStoppedJob(
  input: ParseChartWorkflowInput,
  now: () => number,
  startedAt: number,
  error: unknown,
): void {
  if (!input.signal?.aborted && !isAbortError(error)) return
  const stoppedAt = now()
  input.onEvent?.({
    type: 'job-stopped',
    timestamp: stoppedAt,
    totalDurationMs: stoppedAt - startedAt,
  })
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return
  const error = new Error('Chart parsing stopped')
  error.name = 'AbortError'
  throw error
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}
