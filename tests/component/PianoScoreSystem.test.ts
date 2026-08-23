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

test('test_PianoScoreSystem_when_note_is_tied_then_renders_stave_tie', async () => {
  // Arrange
  const tiedNotes = [
    { ...buildEvent(1, 2, ['C4']), tieToNext: true },
    { ...buildEvent(3, 2, ['C4']), tieFromPrevious: true },
  ]

  // Act
  const wrapper = mount(PianoScoreSystem, {
    props: { system: buildSystem(tiedNotes) },
  })
  await nextTick()

  // Assert
  expect(wrapper.findAll('.vf-stavetie')).toHaveLength(1)
})

test('test_PianoScoreSystem_when_one_chord_pitch_continues_then_renders_partial_ties', async () => {
  // Arrange
  const notes = [
    { ...buildEvent(1, 1, ['C6']), tieToNextPitches: ['C6'] },
    {
      ...buildEvent(2, 1, ['E5', 'B5', 'C6']),
      tieFromPreviousPitches: ['C6'],
      tieToNextPitches: ['C6'],
    },
    { ...buildEvent(3, 1, ['C6']), tieFromPreviousPitches: ['C6'] },
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

test('test_PianoScoreSystem_when_pedal_interval_is_visible_then_renders_pedal_symbols', async () => {
  // Arrange & Act
  const wrapper = mount(PianoScoreSystem, {
    props: {
      system: buildSystem([buildEvent(1, 4, ['C4'])]),
      pedalIntervals: [{ startBeatOffset: 0.5, endBeatOffset: 3 }],
    },
  })
  await nextTick()

  // Assert
  expect(wrapper.text()).toContain('Ped.')
  expect(wrapper.text()).toContain('✱')
})

test('test_PianoScoreSystem_when_both_hands_share_a_beat_then_aligns_noteheads_horizontally', async () => {
  // Arrange
  const rightHand = [
    buildEvent(1, 0.5, ['C#5']),
    buildEvent(1.5, 0.5, ['D5']),
    buildEvent(2, 1, ['E5']),
    buildEvent(3, 2, ['F5']),
  ]
  const leftHand = [
    buildEvent(1, 1, ['C3']),
    buildEvent(2, 2, ['D3']),
    buildEvent(4, 1, ['E3']),
  ]

  // Act
  const wrapper = mount(PianoScoreSystem, {
    props: { system: buildSystem(rightHand, leftHand) },
  })
  await nextTick()

  // Assert
  const renderedNotes = wrapper.findAll('.vf-stavenote')
  const rightBeatTwoX = getNoteheadX(renderedNotes[2]!)
  const leftBeatTwoX = getNoteheadX(renderedNotes[rightHand.length + 1]!)
  expect(rightBeatTwoX).toBeCloseTo(leftBeatTwoX, 3)
})

test('test_PianoScoreSystem_when_accidental_repeats_in_measure_then_renders_it_once', async () => {
  // Arrange
  const rightHand = [
    buildEvent(1, 1, ['C#5']),
    buildEvent(2, 1, ['C#5']),
    buildEvent(3, 2, []),
  ]

  // Act
  const wrapper = mount(PianoScoreSystem, {
    props: { system: buildSystem(rightHand) },
  })
  await nextTick()

  // Assert
  const sharpGlyphs = wrapper.findAll('.vf-notehead text')
    .filter(element => element.text() === '\uE262')
  expect(sharpGlyphs).toHaveLength(1)
})

test('test_PianoScoreSystem_when_key_signature_is_flat_then_renders_signature_without_note_accidental', async () => {
  // Arrange
  const rightHand = [
    buildEvent(1, 1, ['Bb4']),
    buildEvent(2, 1, ['Bb4']),
    buildEvent(3, 2, []),
  ]

  // Act
  const wrapper = mount(PianoScoreSystem, {
    props: { system: buildSystem(rightHand), keySignature: 'Bb' },
  })
  await nextTick()

  // Assert
  expect(wrapper.findAll('.vf-keysignature text')).toHaveLength(4)
  const noteAccidentals = wrapper.findAll('.vf-notehead text')
    .filter(element => element.text() === '\uE260')
  expect(noteAccidentals).toHaveLength(0)
})

function buildSystem(rightHand: ScoreEvent[], leftHand?: ScoreEvent[]) {
  return {
    startMeasureIndex: 0,
    measures: [buildMeasure(rightHand, leftHand)],
  }
}

function buildMeasure(rightHand: ScoreEvent[], leftHand?: ScoreEvent[]): ScoreMeasure {
  return {
    sectionId: 'test',
    sectionLabel: 'Test',
    index: 1,
    chordSymbols: [],
    lyrics: [],
    intensity: 'medium',
    rightHand,
    leftHand: leftHand ?? [buildEvent(1, 2, []), buildEvent(3, 2, [])],
  }
}

function getNoteheadX(note: DOMWrapper<Element>): number {
  return Number(note.find('.vf-notehead text').attributes('x'))
}

function buildEvent(startBeat: number, durationBeats: number, pitches: string[]): ScoreEvent {
  return {
    startBeat,
    durationBeats,
    pitches,
    fingers: [],
    tieToNext: false,
  }
}
