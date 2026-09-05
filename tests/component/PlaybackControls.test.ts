// @vitest-environment nuxt
import { expect, test } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import PlaybackControls from '../../components/PlaybackControls.vue'

test('test_PlaybackControls_when_playing_then_exposes_pause_and_formatted_time', async () => {
  // Arrange
  const wrapper = await mountSuspended(PlaybackControls, { props: {
    status: 'playing', progress: 0.3, elapsedSeconds: 72, durationSeconds: 240,
  } })
  // Act
  await wrapper.get('[aria-label="Pause"]').trigger('click')
  // Assert
  expect(wrapper.emitted('toggle')).toHaveLength(1)
  expect(wrapper.get('time').text()).toBe('01:12 / 04:00')
  expect(wrapper.find('[aria-label="Stop"]').exists()).toBe(false)
  await wrapper.setProps({ status: 'paused' })
  expect(wrapper.find('[aria-label="Play"]').exists()).toBe(true)
})

test('test_PlaybackControls_when_seek_committed_then_emits_fraction', async () => {
  // Arrange
  const wrapper = await mountSuspended(PlaybackControls, { props: {
    status: 'paused', progress: 0, elapsedSeconds: 0, durationSeconds: 240,
  } })
  // Act
  await wrapper.get('input').setValue('0.75')
  // Assert
  expect(wrapper.emitted('seek')?.at(-1)).toEqual([0.75])
})

test('test_PlaybackControls_when_score_requests_stop_then_exposes_stop_action', async () => {
  // Arrange
  const wrapper = await mountSuspended(PlaybackControls, { props: {
    status: 'playing', progress: 0.3, elapsedSeconds: 72, durationSeconds: 240, showStop: true,
  } })
  // Act
  await wrapper.get('[aria-label="Stop"]').trigger('click')
  // Assert
  expect(wrapper.emitted('stop')).toHaveLength(1)
  await wrapper.setProps({ stopDisabled: true, disabled: true })
  expect(wrapper.get('[aria-label="Stop"]').attributes('disabled')).toBeDefined()
  expect(wrapper.get('.play').attributes('disabled')).toBeDefined()
  expect(wrapper.get('input').attributes('disabled')).toBeDefined()
})
