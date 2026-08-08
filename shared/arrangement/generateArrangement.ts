import { parseChordSymbol } from '../music/chords'
import type { ConfirmedChart, ConfirmedChordPlacement } from '../schemas/chart'
import { buildHandPattern } from './patterns'
import type {
  ArrangementLevelName,
  ArrangementSet,
  MeasureIntensity,
  ScoreEvent,
  ScoreLyricCue,
  ScoreMeasure,
  ScoreVersion,
} from './types'

const LEVELS: ArrangementLevelName[] = ['easy', 'rich']

export function generateArrangement(chart: ConfirmedChart): ArrangementSet {
  const blockingIssues = collectBlockingIssues(chart)

  if (blockingIssues.length > 0) {
    return { mood: chart.mood, versions: [], blockingIssues }
  }

  const versions = LEVELS.map((level) => buildScoreVersion(chart, level))
  versions.forEach(validateScoreVersion)
  return { mood: chart.mood, versions, blockingIssues: [] }
}

function buildScoreVersion(chart: ConfirmedChart, level: ArrangementLevelName): ScoreVersion {
  return {
    level,
    measures: chart.sections.flatMap((section) =>
      section.measures.map((measure) => buildScoreMeasure(chart, level, section, measure)),
    ),
  }
}

function buildScoreMeasure(
  chart: ConfirmedChart,
  level: ArrangementLevelName,
  section: ConfirmedChart['sections'][number],
  measure: ConfirmedChart['sections'][number]['measures'][number],
): ScoreMeasure {
  const intensity = getSectionIntensity(section.label)
  let startBeat = 1
  const leftHand: ScoreEvent[] = []
  const rightHand: ScoreEvent[] = []
  const lyrics: ScoreLyricCue[] = buildMeasureLyrics(measure)

  for (const placement of measure.chords) {
    const chord = parseChordSymbol(placement.chord)

    if (!chord) {
      throw new Error(`Unsupported chord reached score builder: ${placement.chord}`)
    }

    const pattern = buildHandPattern({
      chord,
      durationBeats: placement.durationBeats,
      startBeat,
      mood: chart.mood,
      level,
      strongSection: intensity === 'strong',
    })
    const firstRightHandEvent = pattern.rightHand[0]

    if (firstRightHandEvent) {
      firstRightHandEvent.chordSymbol = placement.chord
    }

    leftHand.push(...pattern.leftHand)
    rightHand.push(...pattern.rightHand)
    startBeat += placement.durationBeats
  }

  return {
    sectionId: section.id,
    sectionLabel: section.label,
    index: measure.index,
    chordSymbols: measure.chords.map((placement) => placement.chord),
    lyrics,
    intensity,
    leftHand,
    rightHand,
  }
}

function buildMeasureLyrics(
  measure: ConfirmedChart['sections'][number]['measures'][number],
): ScoreLyricCue[] {
  const measureLyric = measure.lyric?.trim()

  if (measureLyric) {
    return [{ startBeat: 1, text: measureLyric }]
  }

  let startBeat = 1
  const lyrics: ScoreLyricCue[] = []

  for (const placement of measure.chords) {
    const lyric = placement.lyric?.trim()
    if (lyric) {
      lyrics.push({ startBeat, text: lyric })
    }

    startBeat += placement.durationBeats
  }

  return lyrics
}

function getSectionIntensity(label: string): MeasureIntensity {
  const normalizedLabel = label.toLowerCase()

  if (normalizedLabel.includes('chorus') || normalizedLabel.includes('refrain') || label.includes('副歌')) {
    return 'strong'
  }

  if (normalizedLabel.includes('intro') || normalizedLabel.includes('outro') || label.includes('前奏') || label.includes('尾奏')) {
    return 'soft'
  }

  return 'medium'
}

function collectBlockingIssues(chart: ConfirmedChart): string[] {
  return chart.sections.flatMap((section) =>
    section.measures.flatMap((measure) =>
      measure.chords.flatMap((placement) => buildChordIssues(placement)),
    ),
  )
}

function buildChordIssues(placement: ConfirmedChordPlacement): string[] {
  return parseChordSymbol(placement.chord) ? [] : [`Unsupported chord: ${placement.chord}`]
}

function validateScoreVersion(version: ScoreVersion): void {
  for (const measure of version.measures) {
    validateHandDuration(measure.leftHand, measure, 'left')
    validateHandDuration(measure.rightHand, measure, 'right')
  }
}

function validateHandDuration(
  events: ScoreEvent[],
  measure: ScoreMeasure,
  hand: 'left' | 'right',
): void {
  const total = events.reduce((duration, event) => duration + event.durationBeats, 0)

  if (Math.abs(total - 4) > Number.EPSILON) {
    throw new Error(`${hand} hand does not fill four beats in ${measure.sectionLabel} measure ${measure.index}`)
  }
}
