import { createError, createEventStream, readBody } from 'h3'
import { getParseChartErrorMessage } from '../../shared/errors/parseChartError'
import { ParseChartRequestSchema } from '../../shared/schemas/chart'
import type { ChartStreamMessage } from '../../shared/schemas/chartStream'
import {
  createOpenAIChartClient,
  parseChartImages,
} from '../services/openaiChartParser'

export default defineEventHandler(async (event) => {
  const request = ParseChartRequestSchema.safeParse(await readBody(event))
  if (!request.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid parse-chart request' })
  }

  const config = useRuntimeConfig(event)
  if (!config.openaiApiKey) {
    throw createError({ statusCode: 500, statusMessage: 'OpenAI API key is missing' })
  }

  const eventStream = createEventStream(event)
  const controller = new AbortController()
  let writes = Promise.resolve()

  const push = (message: ChartStreamMessage): void => {
    writes = writes.then(() => eventStream.push({ data: JSON.stringify(message) }))
  }

  eventStream.onClosed(() => controller.abort())

  void (async () => {
    try {
      const chart = await parseChartImages({
        client: createOpenAIChartClient(config.openaiApiKey),
        model: request.data.model,
        images: request.data.images,
        signal: controller.signal,
        onEvent: progressEvent => push({ type: 'progress', event: progressEvent }),
        onModelOutput: (taskId, output) => {
          if (config.logModelOutput) {
            console.info('[parse-chart:model-output]', { taskId, output })
          }
        },
      })
      push({ type: 'result', chart })
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error('[parse-chart:error]', error)
        push({ type: 'error', message: getParseChartErrorMessage(error) })
      }
    } finally {
      await writes
      await eventStream.close()
    }
  })()

  return eventStream.send()
})
