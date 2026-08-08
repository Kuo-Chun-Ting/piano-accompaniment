import {
  CompactChartResponseSchema,
} from './compactChartResponse'
import type { ChartTaskDefinition } from './openaiChartTask'

export function buildReadingChartTask(): ChartTaskDefinition<typeof CompactChartResponseSchema> {
  return {
    id: 'read-chart',
    kind: 'reading-chart',
    title: 'Reading chart',
    schemaName: 'chord_chart',
    schema: CompactChartResponseSchema,
    prompt: chartReadingRules().join('\n'),
  }
}

function chartReadingRules(): string[] {
  return [
    'Read the complete visible chord chart from all uploaded images in source order.',
    'Return metadata, ordered sections, 4/4 measures, chord symbols, beat durations, measure lyrics, lyric variants, and navigation annotations.',
    'Copy visible lyrics character by character. Do not correct from song memory, complete sentences, or infer cropped text.',
    'Keep each lyric fragment in the measure directly above its horizontal span. A phrase may end mid-sentence.',
    'Visible vertical bars are authoritative measure boundaries. Do not create boundaries from line wrapping or spacing.',
    'Every measure must total exactly 4 beats. Infer one chord as 4, two as 2+2, and four as 1+1+1+1 unless printed timing says otherwise.',
    'For three chords, use printed timing and horizontal placement to choose 2+1+1 or 1+1+2.',
    'In 91pu notation, |F (2拍)|F/G G| is one measure: F has 2 beats, F/G has 1 beat, and G has 1 beat.',
    'Treat dash marks as held duration, not new chord symbols. Ignore guitar diagrams and strumming or fingering references.',
    'Preserve numbered lyric alternatives as lyricVariants on the same measures; do not turn them into additional performance measures.',
    'Normalize flats and sharps to ASCII while preserving chord quality and slash bass.',
    'Use uncertainty fields only when the corresponding visible value is genuinely ambiguous.',
    'Recommend one mood from spacious-ballad, flowing-narrative, or urban-groove using visible tempo and harmonic rhythm.',
  ]
}
