import { z } from 'zod'
import { normalizeChordSymbol } from '../../shared/music/chords'
import {
  ChartAnnotationTypeSchema,
  ExtractedChartSchema,
  ModeSchema,
  MoodSchema,
  type Confidence,
  type ExtractedChart,
} from '../../shared/schemas/chart'

const ChartFieldSchema = z.enum(['title', 'originalKey', 'mode', 'meter', 'tempo'])
const PlacementFieldSchema = z.enum(['symbol', 'beats'])

const CompactChordSchema = z.object({
  symbol: z.string().min(1),
  beats: z.number().min(0.5).max(4).nullable(),
  uncertainFields: z.array(PlacementFieldSchema),
}).strict()

const CompactMeasureSchema = z.object({
  index: z.number().int().positive(),
  boundaryUncertain: z.boolean(),
  lyric: z.string().min(1).nullable(),
  lyricVariants: z.array(z.string().min(1)),
  lyricUncertain: z.boolean(),
  chords: z.array(CompactChordSchema).min(1),
}).strict()

const CompactSectionSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  order: z.number().int().positive(),
  uncertain: z.boolean(),
  measures: z.array(CompactMeasureSchema).min(1),
}).strict()

const CompactAnnotationSchema = z.object({
  type: ChartAnnotationTypeSchema,
  text: z.string().min(1),
  sectionId: z.string().min(1).nullable(),
  measureIndex: z.number().int().positive().nullable(),
  targetMarker: z.string().min(1).nullable(),
}).strict()

export const CompactChartResponseSchema = z.object({
  title: z.string().min(1).nullable(),
  originalKey: z.string().min(1).nullable(),
  mode: ModeSchema.nullable(),
  meter: z.literal('4/4').nullable(),
  tempo: z.number().int().positive().nullable(),
  uncertainFields: z.array(ChartFieldSchema),
  moodRecommendation: z.object({
    mood: MoodSchema,
    uncertain: z.boolean(),
    rationale: z.string(),
  }).strict(),
  sections: z.array(CompactSectionSchema).min(1),
  annotations: z.array(CompactAnnotationSchema),
  warnings: z.array(z.string()),
}).strict()

export type CompactChartResponse = z.infer<typeof CompactChartResponseSchema>

export function expandCompactChartResponse(compactChart: CompactChartResponse): ExtractedChart {
  return ExtractedChartSchema.parse({
    title: expandField(compactChart.title, compactChart.uncertainFields.includes('title')),
    originalKey: expandField(
      compactChart.originalKey,
      compactChart.uncertainFields.includes('originalKey'),
    ),
    mode: expandField(compactChart.mode, compactChart.uncertainFields.includes('mode')),
    meter: expandField(compactChart.meter, compactChart.uncertainFields.includes('meter')),
    tempo: expandField(compactChart.tempo, compactChart.uncertainFields.includes('tempo')),
    moodRecommendation: {
      mood: compactChart.moodRecommendation.mood,
      confidence: compactChart.moodRecommendation.uncertain ? 'uncertain' : 'visible',
      rationale: compactChart.moodRecommendation.rationale,
    },
    sections: compactChart.sections.map(section => ({
      id: section.id,
      label: section.label.trim() || `Section ${section.order}`,
      order: section.order,
      confidence: section.uncertain ? 'uncertain' : 'visible',
      measures: section.measures.map(measure => expandMeasure(measure)),
    })),
    annotations: compactChart.annotations,
    warnings: compactChart.warnings,
  })
}

function expandMeasure(measure: z.infer<typeof CompactMeasureSchema>) {
  const lyricConfidence: Confidence = measure.lyric === null
    ? 'missing'
    : measure.lyricUncertain ? 'uncertain' : 'visible'

  return {
    index: measure.index,
    boundaryConfidence: measure.boundaryUncertain ? 'uncertain' as const : 'visible' as const,
    lyric: { value: measure.lyric, confidence: lyricConfidence },
    ...(measure.lyricVariants.length > 0 ? { lyricVariants: measure.lyricVariants } : {}),
    chords: measure.chords.map((chord, index) => ({
      chord: expandField(
        normalizeChordSymbol(chord.symbol) ?? chord.symbol,
        chord.uncertainFields.includes('symbol'),
      ),
      durationBeats: expandField(chord.beats, chord.uncertainFields.includes('beats')),
      lyric: {
        value: index === 0 ? measure.lyric : null,
        confidence: index === 0 ? lyricConfidence : 'missing' as const,
      },
    })),
  }
}

function expandField<Value>(
  value: Value | null,
  uncertain: boolean,
): { value: Value | null, confidence: Confidence } {
  return {
    value,
    confidence: value === null ? 'missing' : uncertain ? 'uncertain' : 'visible',
  }
}
