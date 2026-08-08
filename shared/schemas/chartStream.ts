import { z } from 'zod'
import { ExtractedChartSchema } from './chart'
import { ChartTaskEventSchema } from './chartProcessing'

export const ChartStreamMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('progress'),
    event: ChartTaskEventSchema,
  }).strict(),
  z.object({
    type: z.literal('result'),
    chart: ExtractedChartSchema,
  }).strict(),
  z.object({
    type: z.literal('error'),
    message: z.string().min(1),
  }).strict(),
])

export type ChartStreamMessage = z.infer<typeof ChartStreamMessageSchema>

export function encodeChartStreamMessage(message: ChartStreamMessage): string {
  return `data: ${JSON.stringify(ChartStreamMessageSchema.parse(message))}\n\n`
}

export function decodeChartStreamBlocks(input: string): {
  messages: ChartStreamMessage[]
  remainder: string
} {
  const blocks = input.split('\n\n')
  const remainder = blocks.pop() ?? ''
  const messages = blocks
    .map(block => block.split('\n').find(line => line.startsWith('data: ')))
    .filter((line): line is string => Boolean(line))
    .map(line => ChartStreamMessageSchema.parse(JSON.parse(line.slice(6)) as unknown))

  return { messages, remainder }
}
