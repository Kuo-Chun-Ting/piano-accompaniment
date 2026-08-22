import { z } from 'zod'
import type { ScoreVersion } from '../../shared/arrangement/types'

const ScoreEventSchema = z.object({
  startBeat: z.number().min(1).max(4.5),
  durationBeats: z.union([z.literal(0.5), z.literal(1), z.literal(2), z.literal(4)]),
  pitches: z.array(z.string().regex(/^[A-G](?:#|b)?\d$/)),
  fingers: z.array(z.number().int().min(1).max(5)),
  tieToNext: z.boolean(),
  tieFromPrevious: z.boolean().optional(),
  chordSymbol: z.string().optional(),
})

const ScoreMeasureSchema = z.object({
  sectionId: z.string().min(1),
  sectionLabel: z.string().min(1),
  index: z.number().int().positive(),
  chordSymbols: z.array(z.string()),
  lyrics: z.array(z.object({
    startBeat: z.number().min(1).max(4.5),
    text: z.string(),
  })),
  intensity: z.enum(['soft', 'medium', 'strong']),
  rightHand: z.array(ScoreEventSchema).min(1),
  leftHand: z.array(ScoreEventSchema).min(1),
}).superRefine((measure, context) => {
  for (const hand of ['rightHand', 'leftHand'] as const) {
    const duration = measure[hand].reduce((sum, event) => sum + event.durationBeats, 0)
    if (duration !== 4) {
      context.addIssue({
        code: 'custom',
        path: [hand],
        message: `${hand} must fill four beats`,
      })
    }
  }
})

const ScorePedalIntervalSchema = z.object({
  startBeatOffset: z.number().nonnegative(),
  endBeatOffset: z.number().positive(),
}).refine(interval => interval.endBeatOffset > interval.startBeatOffset, {
  message: 'Pedal interval must end after it starts',
})

const ScoreKeySignatureSchema = z.enum([
  'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#',
  'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb',
])

const ViewerScoreDataSchema = z.object({
  title: z.string().trim().min(1),
  tempo: z.number().int().positive(),
  version: z.object({
    level: z.enum(['easy', 'rich']),
    measures: z.array(ScoreMeasureSchema).min(1),
    keySignature: ScoreKeySignatureSchema.optional(),
    pedalIntervals: z.array(ScorePedalIntervalSchema).optional(),
  }),
})

export type ViewerScoreData = {
  title: string
  tempo: number
  version: ScoreVersion
}

export function parseViewerData(value: unknown): ViewerScoreData {
  const result = ViewerScoreDataSchema.safeParse(value)
  if (!result.success) {
    throw new Error(`Viewer score data is invalid: ${z.prettifyError(result.error)}`)
  }

  return result.data
}
