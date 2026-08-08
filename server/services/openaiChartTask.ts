import { zodTextFormat } from 'openai/helpers/zod'
import type { ResponseCreateParamsNonStreaming } from 'openai/resources/responses/responses'
import type { z } from 'zod'
import type {
  ChartTaskEvent,
  ChartTaskKind,
} from '../../shared/schemas/chartProcessing'
import type { UploadedImage } from '../../shared/schemas/chart'

export type ChartTaskResponse = {
  output_text: string
  usage?: {
    input_tokens: number
    output_tokens: number
    total_tokens: number
    output_tokens_details?: {
      reasoning_tokens?: number
    }
  }
}

export type ChartTaskClient = {
  responses: {
    create: (
      request: ResponseCreateParamsNonStreaming,
      options?: { signal?: AbortSignal },
    ) => Promise<ChartTaskResponse>
  }
}

export type ChartTaskDefinition<Schema extends z.ZodType> = {
  id: string
  kind: ChartTaskKind
  title: string
  prompt: string
  schemaName: string
  schema: Schema
}

export type RunChartTaskInput<Schema extends z.ZodType> = {
  client: ChartTaskClient
  model: string
  task: ChartTaskDefinition<Schema>
  images: UploadedImage[]
  signal?: AbortSignal
  attempt?: number
  now?: () => number
  onEvent?: (event: ChartTaskEvent) => void
  onRawOutput?: (taskId: string, output: string) => void
}

export async function runChartTask<Schema extends z.ZodType>(
  input: RunChartTaskInput<Schema>,
): Promise<z.infer<Schema>> {
  const now = input.now ?? (() => performance.now())
  const attempt = input.attempt ?? 1
  const startedAt = now()
  input.onEvent?.(buildStartedEvent(input.task, attempt, startedAt))

  try {
    const response = await input.client.responses.create(
      buildRequest(input),
      { signal: input.signal },
    )
    input.onRawOutput?.(input.task.id, response.output_text)
    const result = parseTaskOutput(input.task, response.output_text)
    const completedAt = now()
    input.onEvent?.(buildCompletedEvent(input.task, attempt, startedAt, completedAt))
    return result
  } catch (error) {
    const failedAt = now()
    input.onEvent?.(buildFailedEvent(input.task, attempt, startedAt, failedAt, error))
    throw error
  }
}

function buildRequest<Schema extends z.ZodType>(
  input: RunChartTaskInput<Schema>,
): ResponseCreateParamsNonStreaming {
  return {
    model: input.model,
    store: false,
    input: [{
      role: 'user',
      content: [
        { type: 'input_text', text: input.task.prompt },
        ...buildImageContent(input.images),
      ],
    }],
    text: {
      format: zodTextFormat(input.task.schema, input.task.schemaName),
    },
  }
}

function buildImageContent(
  images: UploadedImage[],
): Array<{ type: 'input_image', image_url: string, detail: 'high' }> {
  return [...images]
    .sort((left, right) => left.order - right.order)
    .map((image) => ({
      type: 'input_image',
      image_url: image.dataUrl,
      detail: 'high',
    }))
}

function parseTaskOutput<Schema extends z.ZodType>(
  task: ChartTaskDefinition<Schema>,
  output: string,
): z.infer<Schema> {
  let parsed: unknown

  try {
    parsed = JSON.parse(output) as unknown
  } catch {
    throw new Error(`AI task output did not include valid JSON for ${task.schemaName}`)
  }

  const result = task.schema.safeParse(parsed)
  if (!result.success) {
    throw new Error(`AI task output did not match ${task.schemaName}`)
  }

  return result.data
}

function buildStartedEvent<Schema extends z.ZodType>(
  task: ChartTaskDefinition<Schema>,
  attempt: number,
  timestamp: number,
): ChartTaskEvent {
  return {
    type: 'task-started',
    taskId: task.id,
    kind: task.kind,
    title: task.title,
    attempt,
    timestamp,
  }
}

function buildCompletedEvent<Schema extends z.ZodType>(
  task: ChartTaskDefinition<Schema>,
  attempt: number,
  startedAt: number,
  completedAt: number,
): ChartTaskEvent {
  return {
    type: 'task-completed',
    taskId: task.id,
    kind: task.kind,
    title: task.title,
    attempt,
    timestamp: completedAt,
    durationMs: completedAt - startedAt,
  }
}

function buildFailedEvent<Schema extends z.ZodType>(
  task: ChartTaskDefinition<Schema>,
  attempt: number,
  startedAt: number,
  failedAt: number,
  error: unknown,
): ChartTaskEvent {
  return {
    type: 'task-failed',
    taskId: task.id,
    kind: task.kind,
    title: task.title,
    attempt,
    timestamp: failedAt,
    durationMs: failedAt - startedAt,
    message: error instanceof Error ? error.message : 'AI task failed',
  }
}
