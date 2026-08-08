import { z } from 'zod'
import { ChartReadingModelIdSchema } from '../chart-reading/models'

export const ConfidenceSchema = z.enum(['visible', 'uncertain', 'missing'])
export type Confidence = z.infer<typeof ConfidenceSchema>

export const ModeSchema = z.enum(['major', 'minor'])
export type Mode = z.infer<typeof ModeSchema>

export const MoodSchema = z.enum(['spacious-ballad', 'flowing-narrative', 'urban-groove'])
export type Mood = z.infer<typeof MoodSchema>

export const NormalizedKeySchema = z.enum(['C', 'Am'])
export type NormalizedKey = z.infer<typeof NormalizedKeySchema>

export const ExtractedFieldSchema = <ValueSchema extends z.ZodTypeAny>(valueSchema: ValueSchema) =>
  z.object({
    value: valueSchema.nullable(),
    confidence: ConfidenceSchema,
    note: z.string().optional(),
  })

export const MoodRecommendationSchema = z.object({
  mood: MoodSchema,
  confidence: ConfidenceSchema,
  rationale: z.string(),
})
export type MoodRecommendation = z.infer<typeof MoodRecommendationSchema>

export const ChartAnnotationTypeSchema = z.enum(['repeat', 'modulation', 'ending', 'instruction'])
export type ChartAnnotationType = z.infer<typeof ChartAnnotationTypeSchema>

export const ChartAnnotationSchema = z.object({
  type: ChartAnnotationTypeSchema,
  text: z.string().min(1),
  sectionId: z.string().min(1).nullable(),
  measureIndex: z.number().int().positive().nullable(),
  targetMarker: z.string().min(1).nullable(),
})
export type ChartAnnotation = z.infer<typeof ChartAnnotationSchema>

export const ExtractedChordPlacementSchema = z.object({
  chord: ExtractedFieldSchema(z.string().min(1)),
  durationBeats: ExtractedFieldSchema(z.number().min(0.5).max(4)),
  lyric: ExtractedFieldSchema(z.string().min(1)),
})
export type ExtractedChordPlacement = z.infer<typeof ExtractedChordPlacementSchema>

export const ExtractedMeasureSchema = z.object({
  index: z.number().int().positive(),
  boundaryConfidence: ConfidenceSchema,
  lyric: ExtractedFieldSchema(z.string().min(1)),
  lyricVariants: z.array(z.string().min(1)).optional(),
  chords: z.array(ExtractedChordPlacementSchema).min(1),
})
export type ExtractedMeasure = z.infer<typeof ExtractedMeasureSchema>

export const ChartSectionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  order: z.number().int().positive(),
  confidence: ConfidenceSchema,
  measures: z.array(ExtractedMeasureSchema).min(1),
})
export type ChartSection = z.infer<typeof ChartSectionSchema>

export const ExtractedChartSchema = z.object({
  title: ExtractedFieldSchema(z.string().min(1)),
  originalKey: ExtractedFieldSchema(z.string().min(1)),
  mode: ExtractedFieldSchema(ModeSchema),
  meter: ExtractedFieldSchema(z.literal('4/4')),
  tempo: ExtractedFieldSchema(z.number().int().positive()),
  moodRecommendation: MoodRecommendationSchema,
  sections: z.array(ChartSectionSchema).min(1),
  annotations: z.array(ChartAnnotationSchema),
  warnings: z.array(z.string()),
})
export type ExtractedChart = z.infer<typeof ExtractedChartSchema>

export const ConfirmedChordPlacementSchema = z.object({
  chord: z.string().min(1),
  durationBeats: z.number().min(0.5).max(4),
  lyric: z.string().nullable().default(null),
  sourceChordConfidence: ConfidenceSchema,
  sourceDurationConfidence: ConfidenceSchema,
  sourceLyricConfidence: ConfidenceSchema,
  wasEdited: z.boolean(),
})
export type ConfirmedChordPlacement = z.infer<typeof ConfirmedChordPlacementSchema>

export const ConfirmedMeasureSchema = z.object({
  index: z.number().int().positive(),
  lyric: z.string().nullable().default(null),
  lyricVariants: z.array(z.string().min(1)).optional(),
  sourceLyricConfidence: ConfidenceSchema.optional(),
  chords: z.array(ConfirmedChordPlacementSchema).min(1),
})
export type ConfirmedMeasure = z.infer<typeof ConfirmedMeasureSchema>

export const ConfirmedSectionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  order: z.number().int().positive(),
  measures: z.array(ConfirmedMeasureSchema).min(1),
})
export type ConfirmedSection = z.infer<typeof ConfirmedSectionSchema>

export const ConfirmedChartSchema = z.object({
  title: z.string().nullable(),
  originalKey: z.string().min(1),
  mode: ModeSchema,
  normalizedKey: NormalizedKeySchema,
  meter: z.literal('4/4'),
  tempo: z.number().int().positive().nullable(),
  mood: MoodSchema,
  sections: z.array(ConfirmedSectionSchema).min(1),
})
export type ConfirmedChart = z.infer<typeof ConfirmedChartSchema>

export const UploadedImageSchema = z.object({
  filename: z.string().trim().min(1),
  dataUrl: z.string().startsWith('data:image/'),
  order: z.number().int().nonnegative(),
})
export type UploadedImage = z.infer<typeof UploadedImageSchema>

export const ParseChartRequestSchema = z.object({
  model: ChartReadingModelIdSchema,
  images: z.array(UploadedImageSchema).min(1),
})
export type ParseChartRequest = z.infer<typeof ParseChartRequestSchema>

export const ParseChartResponseSchema = z.object({
  chart: ExtractedChartSchema,
})
export type ParseChartResponse = z.infer<typeof ParseChartResponseSchema>

export type BuildConfirmedChartInput = {
  extractedChart: ExtractedChart
  normalizedKey: NormalizedKey
  mood: Mood
  sections: ConfirmedSection[]
}

export type ConfirmChartSelection = Omit<BuildConfirmedChartInput, 'extractedChart'>

export function buildConfirmedChart(input: BuildConfirmedChartInput): ConfirmedChart {
  validateMeasureDurations(input.sections)

  const mode = input.normalizedKey === 'Am' ? 'minor' : 'major'
  const originalKey = input.extractedChart.originalKey.value

  if (!originalKey) {
    throw new Error('Original key is required before generating accompaniment')
  }

  return ConfirmedChartSchema.parse({
    title: input.extractedChart.title.value,
    originalKey,
    mode,
    normalizedKey: input.normalizedKey,
    meter: '4/4',
    tempo: input.extractedChart.tempo.value,
    mood: input.mood,
    sections: input.sections,
  })
}

function validateMeasureDurations(sections: ConfirmedSection[]): void {
  const hasInvalidMeasure = sections.some((section) =>
    section.measures.some((measure) => {
      const totalBeats = measure.chords.reduce((total, chord) => total + chord.durationBeats, 0)
      return Math.abs(totalBeats - 4) > Number.EPSILON
    }),
  )

  if (hasInvalidMeasure) {
    throw new Error('Each measure must total exactly four beats')
  }
}
