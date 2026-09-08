// @vitest-environment nuxt
import { beforeEach, expect, test, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { ref } from 'vue'
import ArrangementGrid from '../../components/ArrangementGrid.vue'
import type { ArrangementSet, ScoreMeasure, ScoreMetadata } from '../../shared/arrangement/types'

const mockUsePianoPlayback = vi.hoisted(() => vi.fn())

mockNuxtImport('usePianoPlayback', () => mockUsePianoPlayback)

const mockTogglePlayback = vi.fn()
const mockSeekPlayback = vi.fn()
const mockChangePlaybackTempo = vi.fn()
const mockStopPlayback = vi.fn()
const mockSetPlaybackMode = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  mockUsePianoPlayback.mockReturnValue({
    status: ref('idle'),
    errorMessage: ref(null),
    mode: ref('score'),
    position: ref({
      elapsedSeconds: 0,
      totalDurationSeconds: 0,
      progress: 0,
      measureIndex: 0,
      measureProgress: 0,
    }),
    togglePlayback: mockTogglePlayback,
    seekPlayback: mockSeekPlayback,
    changePlaybackTempo: mockChangePlaybackTempo,
    setPlaybackMode: mockSetPlaybackMode,
    stopPlayback: mockStopPlayback,
  })
})

test('test_ArrangementGrid_when_play_is_clicked_then_plays_rich_version_at_source_tempo', async () => {
  // Arrange
  const wrapper = await mountArrangementGrid()

  // Act
  await wrapper.get('button.play').trigger('click')

  // Assert
  expect(wrapper.get('input[aria-label="Playback BPM"]').attributes('value')).toBe('72')
  expect(mockTogglePlayback).toHaveBeenCalledWith(
    expect.objectContaining({ level: 'rich' }),
    72,
  )
})

test('test_ArrangementGrid_when_version_changes_then_stops_and_plays_selected_version', async () => {
  // Arrange
  const wrapper = await mountArrangementGrid()

  // Act
  await wrapper.get('[aria-label="Arrangement versions"] button:first-child').trigger('click')
  await wrapper.get('button.play').trigger('click')

  // Assert
  expect(mockStopPlayback).toHaveBeenCalledOnce()
  expect(mockTogglePlayback).toHaveBeenCalledWith(
    expect.objectContaining({ level: 'easy' }),
    72,
  )
})

test('test_ArrangementGrid_when_version_switcher_is_hidden_then_keeps_playback_controls', async () => {
  // Arrange
  const wrapper = await mountSuspended(ArrangementGrid, {
    props: {
      active: true,
      arrangements: buildArrangementSet(),
      chart: buildScoreMetadata(),
      showVersionSwitcher: false,
    },
    global: {
      stubs: {
        PianoScore: {
          template: '<div data-test="piano-score" />',
        },
      },
    },
  })

  // Act
  const versionSwitcher = wrapper.find('[aria-label="Arrangement versions"]')

  // Assert
  expect(versionSwitcher.exists()).toBe(false)
  expect(wrapper.find('button.play').exists()).toBe(true)
  expect(wrapper.find('button.stop').exists()).toBe(true)
  expect(wrapper.find('input[aria-label="Playback progress"]').exists()).toBe(true)
  expect(wrapper.find('input[aria-label="Playback BPM"]').exists()).toBe(true)
  expect(wrapper.get('.player-controls [aria-label="Playback source"]').text()).toBe('Score')
  expect(wrapper.find('details[aria-label="Playback source menu"]').exists()).toBe(false)
})

test('test_ArrangementGrid_when_reference_audio_is_available_then_selects_source_below_transport', async () => {
  // Arrange
  const wrapper = await mountSuspended(ArrangementGrid, {
    props: {
      active: true,
      arrangements: buildArrangementSet(),
      chart: buildScoreMetadata(),
      referenceAudio: {
        src: 'piano.wav',
        scoreStartSeconds: 8.79,
        sourceBpm: 71,
        beatSeconds: [8.79, 9.61, 10.48],
      },
    },
    global: {
      stubs: {
        PianoScore: { template: '<div data-test="piano-score" />' },
      },
    },
  })

  // Act
  await wrapper.get('[aria-label="Original Piano"]').trigger('click')

  // Assert
  expect(wrapper.findAll('button.play')).toHaveLength(1)
  expect(wrapper.find('audio[controls]').exists()).toBe(false)
  expect(wrapper.get('.player-controls [aria-label="Playback source"]').text()).toContain('Score')
  expect(wrapper.find('details[aria-label="Playback source menu"]').exists()).toBe(true)
  expect(wrapper.get('.player-controls').find('button.play').exists()).toBe(true)
  expect(wrapper.get('.player-controls').find('input[aria-label="Playback progress"]').exists()).toBe(true)
  expect(mockSetPlaybackMode).toHaveBeenCalledWith(
    'reference',
    expect.objectContaining({ level: 'rich' }),
    72,
  )
})

test('test_ArrangementGrid_when_tempo_changes_then_forwards_selected_version_and_bpm', async () => {
  // Arrange
  const wrapper = await mountArrangementGrid()
  const input = wrapper.get('input[aria-label="Playback BPM"]')

  // Act
  ;(input.element as HTMLInputElement).value = '96'
  await input.trigger('change')

  // Assert
  expect(mockChangePlaybackTempo).toHaveBeenCalledWith(
    expect.objectContaining({ level: 'rich' }),
    96,
  )
})

test('test_ArrangementGrid_when_arrangement_has_blocking_issue_then_hides_score_controls', async () => {
  // Arrange
  const arrangements = buildArrangementSet()
  arrangements.blockingIssues = ['Unsupported chord: H13']

  // Act
  const wrapper = await mountSuspended(ArrangementGrid, {
    props: {
      active: true,
      arrangements,
      chart: buildScoreMetadata(),
    },
  })

  // Assert
  expect(wrapper.text()).toContain('Unsupported chord: H13')
  expect(wrapper.find('button.play').exists()).toBe(false)
})

async function mountArrangementGrid() {
  return mountSuspended(ArrangementGrid, {
    props: {
      active: true,
      arrangements: buildArrangementSet(),
      chart: buildScoreMetadata(),
    },
    global: {
      stubs: {
        PianoScore: {
          template: '<div data-test="piano-score" />',
        },
      },
    },
  })
}

function buildArrangementSet(): ArrangementSet {
  return {
    mood: 'spacious-ballad',
    blockingIssues: [],
    versions: [
      { level: 'easy', measures: [buildScoreMeasure(1), buildScoreMeasure(2)] },
      { level: 'rich', measures: [buildScoreMeasure(1), buildScoreMeasure(2)] },
    ],
  }
}

function buildScoreMeasure(index: number): ScoreMeasure {
  return {
    sectionId: 'verse',
    sectionLabel: 'Verse',
    index,
    chordSymbols: ['C'],
    lyrics: [],
    intensity: 'medium',
    staves: [
      {
        id: 'treble',
        clef: 'treble',
        voices: [{ id: 'treble-1', events: [{ startBeat: 1, durationBeats: 4, notes: [] }] }],
      },
      {
        id: 'bass',
        clef: 'bass',
        voices: [{ id: 'bass-1', events: [{ startBeat: 1, durationBeats: 4, notes: [] }] }],
      },
    ],
  }
}

function buildScoreMetadata(): ScoreMetadata {
  return { title: 'Fixture Song', tempo: 72 }
}
