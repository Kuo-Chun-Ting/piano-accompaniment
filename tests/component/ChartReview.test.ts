// @vitest-environment nuxt
import { expect, test } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ChartReview from '../../components/ChartReview.vue'
import type { ConfirmChartSelection } from '../../shared/schemas/chart'
import { extractedChartFixture } from '../fixtures/extractedChart'

test('test_ChartReview_when_measure_has_less_than_four_beats_then_disables_score_creation', async () => {
  // Arrange
  const wrapper = await mountSuspended(ChartReview, {
    props: { chart: structuredClone(extractedChartFixture) },
  })

  // Act
  await wrapper.get('.measure:first-child select[aria-label="Duration"]').setValue('3')

  // Assert
  expect(wrapper.get('.measure:first-child .measure-total').text()).toBe('3 / 4')
  expect(wrapper.get('.measure:first-child').classes()).toContain('invalid')
  expect(wrapper.get('button.create-score-button').attributes('disabled')).toBe('')
})

test('test_ChartReview_when_changes_are_undone_and_redone_then_restores_visible_lyric', async () => {
  // Arrange
  const wrapper = await mountSuspended(ChartReview, {
    props: { chart: structuredClone(extractedChartFixture) },
  })
  const lyricInput = wrapper.get('.measure:first-child input[aria-label="Lyrics"]')
  await lyricInput.setValue('first edit')
  await lyricInput.setValue('second edit')

  // Act
  await wrapper.get('button[aria-label="Undo"]').trigger('click')

  // Assert
  expect((lyricInput.element as HTMLInputElement).value).toBe('first edit')

  // Act
  await wrapper.get('button[aria-label="Redo"]').trigger('click')

  // Assert
  expect((lyricInput.element as HTMLInputElement).value).toBe('second edit')
})

test('test_ChartReview_when_chart_is_confirmed_then_emits_current_editor_selection', async () => {
  // Arrange
  const wrapper = await mountSuspended(ChartReview, {
    props: { chart: structuredClone(extractedChartFixture) },
  })

  // Act
  await wrapper.get('.measure:first-child input[aria-label="Chord"]').setValue('Dm')
  await wrapper.get('.measure:first-child input[aria-label="Lyrics"]').setValue('updated lyric')
  await wrapper.get('.chart-settings select').setValue('Am')
  await wrapper.get('select[aria-label="Style"]').setValue('urban-groove')
  await wrapper.get('button.create-score-button').trigger('click')

  // Assert
  const selection = wrapper.emitted('confirm')?.[0]?.[0] as ConfirmChartSelection
  expect(selection.normalizedKey).toBe('Am')
  expect(selection.mood).toBe('urban-groove')
  expect(selection.sections[0].measures[0]).toMatchObject({
    lyric: 'updated lyric',
    chords: [{
      chord: 'Dm',
      durationBeats: 4,
      wasEdited: true,
    }],
  })
})
