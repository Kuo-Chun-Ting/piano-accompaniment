// @vitest-environment nuxt
import { beforeEach, expect, test, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { ref } from 'vue'
import ArrangementGrid from '../../components/ArrangementGrid.vue'
import type { ArrangementSet, ScoreMeasure } from '../../shared/arrangement/types'
import type { ConfirmedChart } from '../../shared/schemas/chart'

const mockUsePianoPlayback = vi.hoisted(() => vi.fn())

mockNuxtImport('usePianoPlayback', () => mockUsePianoPlayback)

const mockTogglePlayback = vi.fn()
const mockSeekPlayback = vi.fn()
const mockChangePlaybackTempo = vi.fn()
const mockStopPlayback = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  mockUsePianoPlayback.mockReturnValue({
    status: ref('idle'),
    errorMessage: ref(null),
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
      chart: buildConfirmedChart(),
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
  expect(wrapper.find('input[aria-label="Score playback progress"]').exists()).toBe(true)
  expect(wrapper.find('input[aria-label="Playback BPM"]').exists()).toBe(true)
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
      chart: buildConfirmedChart(),
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
      chart: buildConfirmedChart(),
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
    rightHand: [],
    leftHand: [],
  }
}

function buildConfirmedChart(): ConfirmedChart {
  return {
    title: 'Fixture Song',
    originalKey: 'C',
    mode: 'major',
    normalizedKey: 'C',
    meter: '4/4',
    tempo: 72,
    mood: 'spacious-ballad',
    sections: [{
      id: 'verse',
      label: 'Verse',
      order: 1,
      measures: [{
        index: 1,
        lyric: 'one',
        chords: [{
          chord: 'C',
          durationBeats: 4,
          lyric: 'one',
          sourceChordConfidence: 'visible',
          sourceDurationConfidence: 'visible',
          sourceLyricConfidence: 'visible',
          wasEdited: false,
        }],
      }],
    }],
  }
}
