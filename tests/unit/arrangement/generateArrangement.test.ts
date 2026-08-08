import { describe, expect, test } from 'vitest'
import { generateArrangement } from '../../../shared/arrangement/generateArrangement'
import type { ConfirmedChart, Mood } from '../../../shared/schemas/chart'

describe('generateArrangement', () => {
  test('test_generateArrangement_when_confirmed_chart_then_returns_easy_and_rich_scores', () => {
    // Arrange
    const chart = buildConfirmedChart('spacious-ballad')

    // Act
    const result = generateArrangement(chart)

    // Assert
    expect(result.versions.map((version) => version.level)).toEqual(['easy', 'rich'])
  })

  test('test_generateArrangement_when_mood_changes_then_returns_expected_rich_rhythms', () => {
    // Arrange
    const moods: Mood[] = ['spacious-ballad', 'flowing-narrative', 'urban-groove']

    // Act
    const rhythms = moods.map((mood) => {
      const result = generateArrangement(buildConfirmedChart(mood))
      const rich = result.versions.find((version) => version.level === 'rich')
      return rich?.measures[0].rightHand.map((event) => ({
        durationBeats: event.durationBeats,
        pitchCount: event.pitches.length,
      }))
    })

    // Assert
    expect(rhythms).toEqual([
      [
        { durationBeats: 1, pitchCount: 3 },
        { durationBeats: 1, pitchCount: 0 },
        { durationBeats: 1, pitchCount: 3 },
        { durationBeats: 1, pitchCount: 0 },
      ],
      Array.from({ length: 8 }, () => ({ durationBeats: 0.5, pitchCount: 1 })),
      [
        { durationBeats: 0.5, pitchCount: 0 },
        { durationBeats: 0.5, pitchCount: 3 },
        { durationBeats: 0.5, pitchCount: 0 },
        { durationBeats: 0.5, pitchCount: 3 },
        { durationBeats: 0.5, pitchCount: 0 },
        { durationBeats: 0.5, pitchCount: 3 },
        { durationBeats: 0.5, pitchCount: 0 },
        { durationBeats: 0.5, pitchCount: 3 },
      ],
    ])
  })

  test('test_generateArrangement_when_section_is_chorus_then_returns_stronger_intensity', () => {
    // Arrange
    const chart = buildConfirmedChart('flowing-narrative')

    // Act
    const result = generateArrangement(chart)
    const rich = result.versions.find((version) => version.level === 'rich')

    // Assert
    expect(rich?.measures.map((measure) => measure.intensity)).toEqual(['medium', 'strong'])
  })

  test('test_generateArrangement_when_section_is_intro_then_returns_soft_intensity', () => {
    // Arrange
    const chart = buildConfirmedChart('flowing-narrative')
    chart.sections[0].label = '[前奏]'

    // Act
    const result = generateArrangement(chart)

    // Assert
    expect(result.versions[0].measures[0].intensity).toBe('soft')
  })

  test('test_generateArrangement_when_score_is_generated_then_each_hand_fills_four_beats', () => {
    // Arrange
    const chart = buildConfirmedChart('urban-groove')

    // Act
    const result = generateArrangement(chart)

    // Assert
    for (const version of result.versions) {
      for (const measure of version.measures) {
        expect(sumDurations(measure.leftHand)).toBe(4)
        expect(sumDurations(measure.rightHand)).toBe(4)
      }
    }
  })

  test('test_generateArrangement_when_chord_changes_then_marks_each_change_on_the_score', () => {
    // Arrange
    const chart = buildConfirmedChart('flowing-narrative')
    chart.sections[0].measures[0].chords = [
      buildChordPlacement('C', 2),
      buildChordPlacement('G/B', 2),
    ]

    // Act
    const result = generateArrangement(chart)
    const easyMeasure = result.versions[0].measures[0]

    // Assert
    expect(easyMeasure.rightHand.filter((event) => event.chordSymbol).map((event) => event.chordSymbol)).toEqual(['C', 'G/B'])
  })

  test('test_generateArrangement_when_chords_have_lyrics_then_positions_each_segment_at_chord_start_beat', () => {
    // Arrange
    const chart = buildConfirmedChart('flowing-narrative')
    chart.sections[0].measures[0].chords = [
      buildChordPlacement('C', 2, '在很久很久'),
      buildChordPlacement('G/B', 2, '以前'),
    ]

    // Act
    const result = generateArrangement(chart)

    // Assert
    expect(result.versions[0].measures[0].lyrics).toEqual([
      { startBeat: 1, text: '在很久很久' },
      { startBeat: 3, text: '以前' },
    ])
  })

  test('test_generateArrangement_when_measure_has_lyric_then_positions_lyric_at_measure_start', () => {
    // Arrange
    const chart = buildConfirmedChart('flowing-narrative')
    chart.sections[0].measures[0].lyric = '我聆聽沉寂已久的心情'
    chart.sections[0].measures[0].chords = [
      buildChordPlacement('F/A', 2, '不應使用'),
      buildChordPlacement('C/G', 2, '和弦歌詞'),
    ]

    // Act
    const result = generateArrangement(chart)

    // Assert
    expect(result.versions[0].measures[0].lyrics).toEqual([
      { startBeat: 1, text: '我聆聽沉寂已久的心情' },
    ])
  })

  test('test_generateArrangement_when_measure_has_no_lyrics_then_returns_empty_lyric_cues', () => {
    // Arrange
    const chart = buildConfirmedChart('spacious-ballad')

    // Act
    const result = generateArrangement(chart)

    // Assert
    expect(result.versions[0].measures[0].lyrics).toEqual([])
  })

  test('test_generateArrangement_when_chord_is_unsupported_then_reports_issue', () => {
    // Arrange
    const chart = buildConfirmedChart('spacious-ballad')
    chart.sections[0].measures[0].chords[0].chord = 'H13'

    // Act
    const result = generateArrangement(chart)

    // Assert
    expect(result.blockingIssues).toEqual(['Unsupported chord: H13'])
    expect(result.versions).toEqual([])
  })

})

function buildConfirmedChart(mood: Mood): ConfirmedChart {
  return {
    title: 'Song',
    originalKey: 'C',
    mode: 'major',
    normalizedKey: 'C',
    meter: '4/4',
    tempo: 72,
    mood,
    sections: [
      buildSection('verse', 'Verse', 1),
      buildSection('chorus', 'Chorus', 2),
    ],
  }
}

function buildSection(id: string, label: string, order: number): ConfirmedChart['sections'][number] {
  return {
    id,
    label,
    order,
    measures: [{
      index: 1,
      lyric: null,
      chords: [{
        chord: 'C',
        durationBeats: 4,
        lyric: null,
        sourceChordConfidence: 'visible',
        sourceDurationConfidence: 'visible',
        sourceLyricConfidence: 'visible',
        wasEdited: false,
      }],
    }],
  }
}

function buildChordPlacement(
  chord: string,
  durationBeats: number,
  lyric: string | null = null,
): ConfirmedChart['sections'][number]['measures'][number]['chords'][number] {
  return {
    chord,
    durationBeats,
    lyric,
    sourceChordConfidence: 'visible',
    sourceDurationConfidence: 'visible',
    sourceLyricConfidence: 'visible',
    wasEdited: false,
  }
}

function sumDurations(events: Array<{ durationBeats: number }>): number {
  return events.reduce((total, event) => total + event.durationBeats, 0)
}
