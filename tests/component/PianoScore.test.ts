// @vitest-environment nuxt
import { expect, test } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import PianoScore from '../../components/PianoScore.vue'
import type { ScoreMeasure, ScoreVersion } from '../../shared/arrangement/types'

test('test_PianoScore_when_system_is_clicked_then_emits_exact_measure_position', async () => {
  // Arrange
  const wrapper = await mountSuspended(PianoScore, {
    props: {
      title: 'Seek fixture',
      version: buildVersion(),
      playbackPosition: {
        elapsedSeconds: 0,
        totalDurationSeconds: 8,
        progress: 0,
        measureIndex: 0,
        measureProgress: 0,
        beat: 1,
        activeEventIds: [],
      },
      showPlaybackPosition: true,
    },
    global: {
      stubs: {
        PianoScoreSystem: { template: '<div />' },
      },
    },
  })
  const system = wrapper.get('.system-row')
  system.element.getBoundingClientRect = () => ({
    left: 0,
    right: 1000,
    top: 0,
    bottom: 200,
    width: 1000,
    height: 200,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  })

  // Act
  await system.trigger('click', { clientX: 375 })

  // Assert
  expect(wrapper.emitted('seekMeasure')).toEqual([[1, 0.5]])
})

function buildVersion(): ScoreVersion {
  return {
    level: 'rich',
    measures: Array.from({ length: 4 }, (_, index) => buildMeasure(index)),
  }
}

function buildMeasure(index: number): ScoreMeasure {
  return {
    sectionId: 'test',
    sectionLabel: '',
    index,
    chordSymbols: [],
    lyrics: [],
    intensity: 'medium',
    staves: [
      {
        id: 'treble',
        clef: 'treble',
        voices: [{
          id: 'treble-1',
          events: [{ startBeat: 1, durationBeats: 4, notes: [{ pitch: 'C4' }] }],
        }],
      },
      {
        id: 'bass',
        clef: 'bass',
        voices: [{
          id: 'bass-1',
          events: [{ startBeat: 1, durationBeats: 4, notes: [{ pitch: 'C3' }] }],
        }],
      },
    ],
  }
}
