// @vitest-environment nuxt
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import AudioFilePreview from '../../components/AudioFilePreview.vue'

beforeEach(() => {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(async function (this: HTMLMediaElement) {
    this.dispatchEvent(new Event('play'))
  })
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement) {
    this.dispatchEvent(new Event('pause'))
  })
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

async function mountPreview() {
  return mountSuspended(AudioFilePreview, { props: { file: new File(['audio'], 'song.wav'), disabled: false } })
}

test('test_AudioFilePreview_when_file_loaded_then_waits_for_play_and_supports_pause_seek', async () => {
  // Arrange
  const wrapper = await mountPreview()
  const media = wrapper.get('audio')
  Object.defineProperty(media.element, 'duration', { configurable: true, value: 240 })
  await media.trigger('loadedmetadata')
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
  // Act
  await wrapper.get('[aria-label="Play"]').trigger('click')
  await flushPromises()
  await wrapper.get('input').setValue('0.5')
  // Assert
  expect((media.element as HTMLAudioElement).currentTime).toBe(120)
  expect(wrapper.get('time').text()).toBe('02:00 / 04:00')
  await wrapper.get('[aria-label="Pause"]').trigger('click')
  expect(wrapper.find('[aria-label="Play"]').exists()).toBe(true)
  wrapper.unmount()
})

test('test_AudioFilePreview_when_play_rejected_then_shows_recoverable_error', async () => {
  // Arrange
  vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new Error('blocked'))
  const wrapper = await mountPreview()
  Object.defineProperty(wrapper.get('audio').element, 'duration', { configurable: true, value: 10 })
  await wrapper.get('audio').trigger('loadedmetadata')
  // Act
  await wrapper.get('[aria-label="Play"]').trigger('click')
  await flushPromises()
  // Assert
  expect(wrapper.get('[role=alert]').text()).toContain('preview')
  expect(wrapper.find('[aria-label="Play"]').exists()).toBe(true)
  wrapper.unmount()
})

test('test_AudioFilePreview_when_transcription_starts_then_pauses_preview', async () => {
  // Arrange
  const wrapper = await mountPreview()
  await wrapper.get('audio').trigger('play')
  // Act
  await wrapper.setProps({ disabled: true })
  // Assert
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled()
  expect(wrapper.get('.play').attributes('disabled')).toBeDefined()
  wrapper.unmount()
})

test('test_AudioFilePreview_when_removed_then_releases_audio_and_object_url', async () => {
  // Arrange
  const wrapper = await mountPreview()
  const media = wrapper.get('audio').element
  // Act
  wrapper.unmount()
  // Assert
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled()
  expect(media.getAttribute('src')).toBeNull()
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview')
})

test('test_AudioFilePreview_when_media_invalid_then_disables_preview_without_transcription_side_effect', async () => {
  // Arrange
  const wrapper = await mountPreview()
  // Act
  await wrapper.get('audio').trigger('error')
  // Assert
  expect(wrapper.get('[role=alert]').text()).toContain('preview')
  expect(wrapper.get('.play').attributes('disabled')).toBeDefined()
  wrapper.unmount()
})

test.each(['replace', 'transcribe'])('test_AudioFilePreview_when_pending_play_interrupted_by_%s_then_ignores_stale_error', async action => {
  // Arrange
  let rejectPlay!: (error: Error) => void
  vi.mocked(HTMLMediaElement.prototype.play).mockImplementationOnce(() => new Promise<void>((_, reject) => { rejectPlay = reject }))
  const wrapper = await mountPreview()
  Object.defineProperty(wrapper.get('audio').element, 'duration', { configurable: true, value: 10 })
  await wrapper.get('audio').trigger('loadedmetadata')
  await wrapper.get('[aria-label="Play"]').trigger('click')
  // Act
  if (action === 'replace') await wrapper.setProps({ file: new File(['new'], 'replacement.wav') })
  else await wrapper.setProps({ disabled: true })
  rejectPlay(new DOMException('Interrupted', 'AbortError'))
  await flushPromises()
  // Assert
  expect(wrapper.find('[role=alert]').exists()).toBe(false)
  wrapper.unmount()
})
