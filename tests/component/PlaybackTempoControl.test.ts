// @vitest-environment nuxt
import { expect, test } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import PlaybackTempoControl from '../../components/PlaybackTempoControl.vue'

test('test_PlaybackTempoControl_when_valid_bpm_is_typed_then_emits_bpm_immediately', async () => {
  // Arrange
  const wrapper = await mountSuspended(PlaybackTempoControl, {
    props: { modelValue: 90, sourceBpm: 72, disabled: false },
  })
  const input = wrapper.get('input')

  // Act
  ;(input.element as HTMLInputElement).value = '120'
  await input.trigger('input')

  // Assert
  expect(wrapper.emitted('update:modelValue')).toEqual([[120]])
})

test('test_PlaybackTempoControl_when_incomplete_bpm_is_typed_then_does_not_emit', async () => {
  // Arrange
  const wrapper = await mountSuspended(PlaybackTempoControl, {
    props: { modelValue: 90, sourceBpm: null, disabled: false },
  })
  const input = wrapper.get('input')

  // Act
  ;(input.element as HTMLInputElement).value = ''
  await input.trigger('input')

  // Assert
  expect(wrapper.emitted('update:modelValue')).toBeUndefined()
})

test('test_PlaybackTempoControl_when_committed_bpm_exceeds_maximum_then_emits_clamped_bpm', async () => {
  // Arrange
  const wrapper = await mountSuspended(PlaybackTempoControl, {
    props: { modelValue: 90, sourceBpm: 90, disabled: false },
  })
  const input = wrapper.get('input')

  // Act
  await input.setValue('400')
  await input.trigger('change')

  // Assert
  expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([200])
})

test('test_PlaybackTempoControl_when_disabled_then_exposes_source_tempo_and_disables_input', async () => {
  // Arrange & Act
  const wrapper = await mountSuspended(PlaybackTempoControl, {
    props: { modelValue: 90, sourceBpm: 72, disabled: true },
  })

  // Assert
  expect(wrapper.get('input').attributes()).toMatchObject({
    disabled: '',
    title: 'Source tempo: 72 BPM',
  })
})
