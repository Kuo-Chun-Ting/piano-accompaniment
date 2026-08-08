import { z } from 'zod'

export const ChartTaskKindSchema = z.literal('reading-chart')

const TaskEventBaseSchema = z.object({
  taskId: z.string().min(1),
  kind: ChartTaskKindSchema,
  title: z.string().min(1),
  attempt: z.number().int().positive(),
  timestamp: z.number().nonnegative(),
})

export const ChartTaskEventSchema = z.discriminatedUnion('type', [
  TaskEventBaseSchema.extend({ type: z.literal('task-started') }).strict(),
  TaskEventBaseSchema.extend({
    type: z.literal('task-completed'),
    durationMs: z.number().nonnegative(),
  }).strict(),
  TaskEventBaseSchema.extend({
    type: z.literal('task-failed'),
    durationMs: z.number().nonnegative(),
    message: z.string().min(1),
  }).strict(),
  z.object({
    type: z.literal('job-completed'),
    timestamp: z.number().nonnegative(),
    totalDurationMs: z.number().nonnegative(),
  }).strict(),
  z.object({
    type: z.literal('job-stopped'),
    timestamp: z.number().nonnegative(),
    totalDurationMs: z.number().nonnegative(),
  }).strict(),
])

export type ChartTaskEvent = z.infer<typeof ChartTaskEventSchema>
export type ChartTaskKind = z.infer<typeof ChartTaskKindSchema>
