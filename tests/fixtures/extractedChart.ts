import type { ExtractedChart } from '../../shared/schemas/chart'

const visible = <Value>(value: Value) => ({ value, confidence: 'visible' as const })

function buildMeasure(index: number, chord: string, lyric: string) {
  return {
    index,
    boundaryConfidence: 'visible' as const,
    lyric: visible(lyric),
    chords: [
      {
        chord: visible(chord),
        durationBeats: visible(4),
        lyric: visible(lyric),
      },
    ],
  }
}

export const extractedChartFixture: ExtractedChart = {
  title: visible('Fixture Song'),
  originalKey: visible('C'),
  mode: visible('major'),
  meter: visible('4/4'),
  tempo: visible(72),
  moodRecommendation: {
    mood: 'spacious-ballad',
    confidence: 'visible',
    rationale: 'Slow harmonic rhythm.',
  },
  sections: [
    {
      id: 'verse-1',
      label: 'Verse',
      order: 1,
      confidence: 'visible',
      measures: [
        buildMeasure(1, 'C', 'one'),
        buildMeasure(2, 'Am', 'two'),
        buildMeasure(3, 'F', 'three'),
        buildMeasure(4, 'G', 'four'),
      ],
    },
  ],
  annotations: [],
  warnings: [],
}
