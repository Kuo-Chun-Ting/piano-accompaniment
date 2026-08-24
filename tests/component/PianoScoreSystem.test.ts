// @vitest-environment happy-dom

import { DOMWrapper, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import PianoScoreSystem from '../../components/PianoScoreSystem.vue'
import type { ScoreEvent, ScoreMeasure } from '../../shared/arrangement/types'

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class {
    constructor(private readonly callback: ResizeObserverCallback) {}

    observe(): void {
      this.callback([], this as unknown as ResizeObserver)
    }

    disconnect(): void {}
  })
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})
})

afterEach(() => vi.unstubAllGlobals())

test('test_PianoScoreSystem_when_eighth_notes_are_beamed_then_does_not_render_flags_on_beamed_notes', async () => {
  // Arrange
  const eighthNotes = Array.from({ length: 8 }, (_, index) =>
    buildEvent(1 + index * 0.5, 0.5, [`${['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C'][index]}${index === 7 ? 5 : 4}`]))

  // Act
  const wrapper = mount(PianoScoreSystem, {
    props: { system: buildSystem(eighthNotes) },
  })
  await nextTick()

  // Assert
  expect(wrapper.findAll('.vf-beam').length).toBeGreaterThan(0)
  expect(wrapper.findAll('.vf-flag')).toHaveLength(0)
})

test('test_PianoScoreSystem_when_sixteenth_notes_are_beamed_then_renders_complete_notes', async () => {
  // Arrange
  const sixteenthNotes = Array.from({ length: 16 }, (_, index) =>
    buildEvent(1 + index * 0.25, 0.25, [`${['C', 'D', 'E', 'F'][index % 4]}4`]))

  // Act
  const wrapper = mount(PianoScoreSystem, {
    props: { system: buildSystem(sixteenthNotes) },
  })
  await nextTick()

  // Assert
  expect(wrapper.findAll('.vf-stavenote').length).toBeGreaterThanOrEqual(16)
  expect(wrapper.findAll('.vf-beam').length).toBeGreaterThan(0)
  expect(wrapper.findAll('.vf-flag')).toHaveLength(0)
})

test('test_PianoScoreSystem_when_note_is_tied_then_renders_stave_tie', async () => {
  // Arrange
  const tiedNotes = [
    buildEvent(1, 2, [{ pitch: 'C4', tieToNext: true }]),
    buildEvent(3, 2, [{ pitch: 'C4', tieFromPrevious: true }]),
  ]

  // Act
  const wrapper = mount(PianoScoreSystem, {
    props: { system: buildSystem(tiedNotes) },
  })
  await nextTick()

  // Assert
  expect(wrapper.findAll('.vf-stavetie')).toHaveLength(1)
})

test('test_PianoScoreSystem_when_note_has_dotted_duration_then_renders_one_notehead_with_dot', async () => {
  // Arrange
  const notes = [
    buildEvent(1, 3, ['C5']),
    buildEvent(4, 1, []),
  ]

  // Act
  const wrapper = mount(PianoScoreSystem, {
    props: { system: buildSystem(notes) },
  })
  await nextTick()

  // Assert
  expect(wrapper.findAll('.vf-stavenote')[0]!.findAll('.vf-notehead text')).toHaveLength(2)
  expect(wrapper.findAll('.vf-stavetie')).toHaveLength(0)
})

test('test_PianoScoreSystem_when_one_chord_pitch_continues_then_renders_partial_ties', async () => {
  // Arrange
  const notes = [
    buildEvent(1, 1, [{ pitch: 'C6', tieToNext: true }]),
    buildEvent(2, 1, [
      { pitch: 'E5' },
      { pitch: 'B5' },
      { pitch: 'C6', tieFromPrevious: true, tieToNext: true },
    ]),
    buildEvent(3, 1, [{ pitch: 'C6', tieFromPrevious: true }]),
    buildEvent(4, 1, []),
  ]

  // Act
  const wrapper = mount(PianoScoreSystem, {
    props: { system: buildSystem(notes) },
  })
  await nextTick()

  // Assert
  expect(wrapper.findAll('.vf-stavetie')).toHaveLength(2)
})

test('test_PianoScoreSystem_when_pedal_interval_is_visible_then_renders_pedal_line_without_text_symbols', async () => {
  // Arrange & Act
  const wrapper = mount(PianoScoreSystem, {
    props: {
      system: buildSystem([buildEvent(1, 4, ['C4'])]),
      pedalIntervals: [{ startBeatOffset: 0.5, endBeatOffset: 3 }],
    },
  })
  await nextTick()

  // Assert
  expect(wrapper.find('.vf-pedal-marking').exists()).toBe(true)
  expect(wrapper.text()).not.toContain('Ped.')
  expect(wrapper.text()).not.toContain('✱')
})

test('test_PianoScoreSystem_when_pedal_tail_at_system_boundary_is_too_short_then_omits_stray_mark', async () => {
  // Arrange
  const system = buildSystem([buildEvent(1, 4, ['C4'])])
  system.startMeasureIndex = 4

  // Act
  const wrapper = mount(PianoScoreSystem, {
    props: {
      system,
      pedalIntervals: [{ startBeatOffset: 15.5, endBeatOffset: 16.4 }],
    },
  })
  await nextTick()

  // Assert
  expect(wrapper.find('.vf-pedal-marking').exists()).toBe(false)
})

test('test_PianoScoreSystem_when_lyrics_are_visible_then_groups_them_for_geometry_validation', async () => {
  // Arrange
  const system = buildSystem([buildEvent(1, 4, ['C4'])])
  system.measures[0]!.lyrics = [{ startBeat: 1, text: '只剩下鋼琴陪我彈了一天' }]

  // Act
  const wrapper = mount(PianoScoreSystem, {
    props: { system },
  })
  await nextTick()

  // Assert
  expect(wrapper.find('.vf-score-lyrics').exists()).toBe(true)
})

test('test_PianoScoreSystem_when_both_staves_share_a_beat_then_aligns_noteheads_horizontally', async () => {
  // Arrange
  const trebleEvents = [
    buildEvent(1, 0.5, ['C#5']),
    buildEvent(1.5, 0.5, ['D5']),
    buildEvent(2, 1, ['E5']),
    buildEvent(3, 2, ['F5']),
  ]
  const bassEvents = [
    buildEvent(1, 1, ['C3']),
    buildEvent(2, 2, ['D3']),
    buildEvent(4, 1, ['E3']),
  ]

  // Act
  const wrapper = mount(PianoScoreSystem, {
    props: { system: buildSystem(trebleEvents, bassEvents) },
  })
  await nextTick()

  // Assert
  const renderedNotes = wrapper.findAll('.vf-stavenote')
  const rightBeatTwoX = getNoteheadX(renderedNotes[2]!)
  const leftBeatTwoX = getNoteheadX(renderedNotes[trebleEvents.length + 1]!)
  expect(rightBeatTwoX).toBeCloseTo(leftBeatTwoX, 3)
})

test('test_PianoScoreSystem_when_staff_has_multiple_voices_then_renders_every_voice', async () => {
  // Arrange
  const trebleVoices = [
    [
      buildEvent(1, 1, ['E5']),
      buildEvent(2, 1, ['F5']),
      buildEvent(3, 1, ['G5']),
      buildEvent(4, 1, ['A5']),
    ],
    [buildEvent(1, 4, ['G4'])],
  ]

  // Act
  const wrapper = mount(PianoScoreSystem, {
    props: { system: buildSystem(trebleVoices[0]!, undefined, trebleVoices) },
  })
  await nextTick()

  // Assert
  expect(wrapper.findAll('.vf-stavenote')).toHaveLength(7)
})

test('test_PianoScoreSystem_when_secondary_voice_has_spacer_then_does_not_render_rest_symbol', async () => {
  // Arrange
  const spacer = {
    ...buildEvent(1, 1, []),
    isSpacer: true as const,
  }
  const trebleVoices = [
    [buildEvent(1, 4, ['C5'])],
    [spacer, buildEvent(2, 3, ['E5'])],
  ]

  // Act
  const wrapper = mount(PianoScoreSystem, {
    props: { system: buildSystem(trebleVoices[0]!, undefined, trebleVoices) },
  })
  await nextTick()

  // Assert
  expect(wrapper.findAll('.vf-stavenote')).toHaveLength(4)
})

test('test_PianoScoreSystem_when_accidental_repeats_in_measure_then_renders_it_once', async () => {
  // Arrange
  const trebleEvents = [
    buildEvent(1, 1, ['C#5']),
    buildEvent(2, 1, ['C#5']),
    buildEvent(3, 2, []),
  ]

  // Act
  const wrapper = mount(PianoScoreSystem, {
    props: { system: buildSystem(trebleEvents) },
  })
  await nextTick()

  // Assert
  const sharpGlyphs = wrapper.findAll('.vf-notehead text')
    .filter(element => element.text() === '\uE262')
  expect(sharpGlyphs).toHaveLength(1)
})

test('test_PianoScoreSystem_when_key_signature_is_flat_then_renders_signature_without_note_accidental', async () => {
  // Arrange
  const trebleEvents = [
    buildEvent(1, 1, ['Bb4']),
    buildEvent(2, 1, ['Bb4']),
    buildEvent(3, 2, []),
  ]

  // Act
  const wrapper = mount(PianoScoreSystem, {
    props: { system: buildSystem(trebleEvents), keySignature: 'Bb' },
  })
  await nextTick()

  // Assert
  expect(wrapper.findAll('.vf-keysignature text')).toHaveLength(4)
  const noteAccidentals = wrapper.findAll('.vf-notehead text')
    .filter(element => element.text() === '\uE260')
  expect(noteAccidentals).toHaveLength(0)
})

test('test_PianoScoreSystem_when_system_is_not_first_then_keeps_clefs_without_repeating_time_signature', async () => {
  // Arrange
  const system = buildSystem([buildEvent(1, 4, ['C5'])])
  system.startMeasureIndex = 4

  // Act
  const wrapper = mount(PianoScoreSystem, {
    props: { system },
  })
  await nextTick()

  // Assert
  expect(wrapper.findAll('.vf-clef')).toHaveLength(2)
  expect(wrapper.findAll('.vf-timesignature')).toHaveLength(0)
})

function buildSystem(
  trebleEvents: ScoreEvent[],
  bassEvents?: ScoreEvent[],
  trebleVoices: ScoreEvent[][] = [trebleEvents],
) {
  return {
    startMeasureIndex: 0,
    measures: [buildMeasure(trebleVoices, bassEvents)],
    measureLayoutUnits: [1],
    isFinalSystem: true,
  }
}

function buildMeasure(trebleVoices: ScoreEvent[][], bassEvents?: ScoreEvent[]): ScoreMeasure {
  return {
    sectionId: 'test',
    sectionLabel: 'Test',
    index: 1,
    chordSymbols: [],
    lyrics: [],
    intensity: 'medium',
    staves: [
      {
        id: 'treble',
        clef: 'treble',
        voices: trebleVoices.map((events, index) => ({ id: `treble-${index + 1}`, events })),
      },
      {
        id: 'bass',
        clef: 'bass',
        voices: [{
          id: 'bass-1',
          events: bassEvents ?? [buildEvent(1, 2, []), buildEvent(3, 2, [])],
        }],
      },
    ],
  }
}

function getNoteheadX(note: DOMWrapper<Element>): number {
  return Number(note.find('.vf-notehead text').attributes('x'))
}

function buildEvent(
  startBeat: number,
  durationBeats: number,
  notes: string[] | ScoreEvent['notes'],
): ScoreEvent {
  return {
    startBeat,
    durationBeats,
    notes: notes.map(note => typeof note === 'string' ? { pitch: note } : note),
  }
}
