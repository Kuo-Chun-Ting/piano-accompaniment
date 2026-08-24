import { describe, expect, test } from 'vitest'
import {
  parseViewerData,
  type ViewerScoreData,
} from '../../../tools/audio-score-viewer/viewerData'

describe('viewerData', () => {
  test('test_parseViewerData_when_payload_is_valid_then_returns_typed_score', () => {
    // Arrange
    const payload = buildPayload()

    // Act
    const result = parseViewerData(payload)

    // Assert
    expect(result).toEqual(payload)
  })

  test('test_parseViewerData_when_tempo_is_invalid_then_throws_clear_error', () => {
    // Arrange
    const payload = { ...buildPayload(), tempo: 0 }

    // Act
    const parse = () => parseViewerData(payload)

    // Assert
    expect(parse).toThrow('Viewer score data is invalid')
  })

  test('test_parseViewerData_when_measure_is_missing_staff_then_throws_clear_error', () => {
    // Arrange
    const payload = buildPayload()
    payload.version.measures[0]!.staves = payload.version.measures[0]!.staves.slice(0, 1)

    // Act
    const parse = () => parseViewerData(payload)

    // Assert
    expect(parse).toThrow('Viewer score data is invalid')
  })

  test('test_parseViewerData_when_reference_audio_is_provided_then_preserves_synchronization_timeline', () => {
    // Arrange
    const payload = {
      ...buildPayload(),
      referenceAudio: {
        src: 'piano.wav',
        scoreStartSeconds: 8.79,
        sourceBpm: 71,
        beatSeconds: [8.79, 9.61, 10.48],
      },
    }

    // Act
    const result = parseViewerData(payload)

    // Assert
    expect(result.referenceAudio).toEqual(payload.referenceAudio)
  })

  test('test_parseViewerData_when_score_contains_pedal_intervals_then_preserves_them', () => {
    // Arrange
    const basePayload = buildPayload()
    const payload = {
      ...basePayload,
      version: {
        ...basePayload.version,
        pedalIntervals: [{
          startBeatOffset: 0.5,
          endBeatOffset: 2,
        }],
      },
    }

    // Act
    const result = parseViewerData(payload)

    // Assert
    expect(result.version.pedalIntervals).toEqual([{
      startBeatOffset: 0.5,
      endBeatOffset: 2,
    }])
  })

  test('test_parseViewerData_when_score_contains_key_signature_then_preserves_it', () => {
    // Arrange
    const basePayload = buildPayload()
    const payload = {
      ...basePayload,
      version: { ...basePayload.version, keySignature: 'Bb' as const },
    }

    // Act
    const result = parseViewerData(payload)

    // Assert
    expect(result.version.keySignature).toBe('Bb')
  })

  test('test_parseViewerData_when_score_contains_dotted_duration_then_preserves_it', () => {
    // Arrange
    const payload = buildPayload()
    payload.version.measures[0]!.staves[0]!.voices[0]!.events = [
      { startBeat: 1, durationBeats: 3, notes: [{ pitch: 'C4' }] },
      { startBeat: 4, durationBeats: 1, notes: [] },
    ]

    // Act
    const result = parseViewerData(payload)

    // Assert
    expect(result.version.measures[0]!.staves[0]!.voices[0]!.events[0]!.durationBeats).toBe(3)
  })

  test('test_parseViewerData_when_score_contains_sixteenth_notes_then_preserves_complete_measure', () => {
    // Arrange
    const payload = buildPayload()
    payload.version.measures[0]!.staves[0]!.voices[0]!.events = Array.from(
      { length: 16 },
      (_, index) => ({
        startBeat: 1 + index * 0.25,
        durationBeats: 0.25,
        notes: [{ pitch: 'C4' }],
      }),
    )

    // Act
    const result = parseViewerData(payload)

    // Assert
    expect(result.version.measures[0]!.staves[0]!.voices[0]!.events).toHaveLength(16)
  })

  test('test_parseViewerData_when_score_contains_spacer_then_preserves_it', () => {
    // Arrange
    const payload = buildPayload()
    payload.version.measures[0]!.staves[0]!.voices[0]!.events[0] = {
      ...payload.version.measures[0]!.staves[0]!.voices[0]!.events[0]!,
      isSpacer: true,
    }

    // Act
    const result = parseViewerData(payload)

    // Assert
    expect(result.version.measures[0]!.staves[0]!.voices[0]!.events[0]!.isSpacer).toBe(true)
  })
})

function buildPayload(): ViewerScoreData {
  return {
    title: 'Recorded Piano',
    tempo: 128,
    version: {
      level: 'rich' as const,
      measures: [{
        sectionId: 'transcription',
        sectionLabel: 'Transcription',
        index: 1,
        chordSymbols: [],
        lyrics: [],
        intensity: 'medium' as const,
        staves: [
          {
            id: 'treble' as const,
            clef: 'treble' as const,
            voices: [{
              id: 'treble-1',
              events: [buildEvent(1, ['C4']), buildEvent(3, [])],
            }],
          },
          {
            id: 'bass' as const,
            clef: 'bass' as const,
            voices: [{
              id: 'bass-1',
              events: [buildEvent(1, []), buildEvent(3, [])],
            }],
          },
        ],
      }],
    },
  }
}

function buildEvent(startBeat: number, pitches: string[]) {
  return {
    startBeat,
    durationBeats: 2,
    notes: pitches.map(pitch => ({ pitch })),
  }
}
