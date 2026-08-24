import { z } from 'zod'
import type { ScoreVersion } from '../../shared/arrangement/types'

const ScoreNoteSchema = z.object({
  pitch: z.string().regex(/^[A-G](?:#|b)?\d$/),
  finger: z.number().int().min(1).max(5).optional(),
  tieToNext: z.boolean().optional(),
  tieFromPrevious: z.boolean().optional(),
})

const ScoreEventSchema = z.object({
  startBeat: z.number().min(1).max(4.5),
  durationBeats: z.union([z.literal(0.5), z.literal(1), z.literal(2), z.literal(4)]),
  notes: z.array(ScoreNoteSchema),
  chordSymbol: z.string().optional(),
})

const ScoreVoiceSchema = z.object({
  id: z.string().min(1),
  events: z.array(ScoreEventSchema).min(1),
}).superRefine((voice, context) => {
  let expectedStartBeat = 1
  voice.events.forEach((event, index) => {
    if (event.startBeat !== expectedStartBeat) {
      context.addIssue({
        code: 'custom',
        path: ['events', index, 'startBeat'],
        message: 'Voice events must be sequential',
      })
    }
    expectedStartBeat += event.durationBeats
  })
  if (expectedStartBeat !== 5) {
    context.addIssue({
      code: 'custom',
      path: ['events'],
      message: 'Voice must fill four beats',
    })
  }
})

const ScoreStaffSchema = z.object({
  id: z.enum(['treble', 'bass']),
  clef: z.enum(['treble', 'bass']),
  voices: z.array(ScoreVoiceSchema).min(1),
}).refine(staff => staff.id === staff.clef, {
  message: 'Staff id and clef must match',
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
  staves: z.array(ScoreStaffSchema).length(2),
}).superRefine((measure, context) => {
  const ids = new Set(measure.staves.map(staff => staff.id))
  if (!ids.has('treble') || !ids.has('bass')) {
    context.addIssue({
      code: 'custom',
      path: ['staves'],
      message: 'Measure must contain treble and bass staves',
    })
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
  pianoAudio: z.string().trim().min(1).optional(),
})

export type ViewerScoreData = {
  title: string
  tempo: number
  version: ScoreVersion
  pianoAudio?: string
}

export function parseViewerData(value: unknown): ViewerScoreData {
  const result = ViewerScoreDataSchema.safeParse(value)
  if (!result.success) {
    throw new Error(`Viewer score data is invalid: ${z.prettifyError(result.error)}`)
  }

  return result.data
}
