// @vitest-environment nuxt
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import AudioScoreWorkspace from '../../components/AudioScoreWorkspace.vue'

const fetchMock = vi.fn()
beforeEach(() => {
  sessionStorage.clear()
  vi.stubGlobal('$fetch', fetchMock)
  fetchMock.mockReset()
})
afterEach(() => vi.unstubAllGlobals())

async function mountAudio() {
  return mountSuspended(AudioScoreWorkspace, { global: { stubs: { AudioScoreResult: true, AudioFilePreview: true } } })
}

async function chooseFile(wrapper: Awaited<ReturnType<typeof mountAudio>>, name: string) {
  const input = wrapper.get('input[type=file]')
  Object.defineProperty(input.element, 'files', { value: [new File(['RIFF0000WAVEtest'], name)], configurable: true })
  await input.trigger('change')
}

test('test_AudioScoreWorkspace_when_non_wav_selected_then_blocks_submit', async () => {
  // Arrange
  const wrapper = await mountAudio()
  // Act
  await chooseFile(wrapper, 'song.mp3')
  // Assert
  expect(wrapper.get('[role=alert]').text()).toContain('WAV')
  expect(wrapper.find('[data-test=start-transcription]').exists()).toBe(false)
  expect(fetchMock).not.toHaveBeenCalled()
  wrapper.unmount()
})

test('test_AudioScoreWorkspace_when_empty_then_shows_note_picker_with_limit_inside', async () => {
  // Arrange & Act
  const wrapper = await mountAudio()
  // Assert
  expect(wrapper.get('.drop-zone input[type=file]').attributes('aria-label')).toBe('Audio file')
  expect(wrapper.get('.drop-zone').text()).toContain('Choose a WAV file')
  expect(wrapper.find('[aria-label="Remove file"]').exists()).toBe(false)
  expect(wrapper.get('.note-head').text()).toContain('Max 100 MB')
  expect(wrapper.find('[data-test=start-transcription]').exists()).toBe(false)
  wrapper.unmount()
})

test('test_AudioScoreWorkspace_when_file_selected_then_note_becomes_transcribe_without_uploading', async () => {
  // Arrange
  const wrapper = await mountAudio()
  const row = wrapper.get('.drop-zone').element
  // Act
  await chooseFile(wrapper, '楓.wav')
  // Assert
  expect(wrapper.get('.drop-zone').element).toBe(row)
  expect(wrapper.get('.file-info').text()).toContain('楓.wav')
  expect(wrapper.find('[aria-label="Remove file"]').exists()).toBe(true)
  expect(wrapper.get('[data-test=start-transcription]').attributes('disabled')).toBeUndefined()
  expect(wrapper.get('[data-test=start-transcription]').text()).toBe('Transcribe')
  expect(fetchMock).not.toHaveBeenCalled()
  // Act
  await wrapper.get('.drop-zone').trigger('drop', { dataTransfer: { files: [new File(['audio'], '安靜.wav')] } })
  // Assert
  expect(wrapper.get('.file-info').text()).toContain('安靜.wav')
  expect(wrapper.get('.file-info').text()).not.toContain('楓.wav')
  wrapper.unmount()
})

test('test_AudioScoreWorkspace_when_wav_dropped_then_selects_file_without_starting_transcription', async () => {
  // Arrange
  const wrapper = await mountAudio()
  const file = new File(['RIFF0000WAVEtest'], 'dropped.wav')
  // Act
  await wrapper.get('.drop-zone').trigger('drop', { dataTransfer: { files: [file] } })
  // Assert
  expect(wrapper.get('.file-info').text()).toContain('dropped.wav')
  expect(wrapper.get('[data-test=start-transcription]').attributes('disabled')).toBeUndefined()
  expect(fetchMock).not.toHaveBeenCalled()
  wrapper.unmount()
})

test('test_AudioScoreWorkspace_when_file_removed_then_returns_to_empty_without_submitting', async () => {
  // Arrange
  const wrapper = await mountAudio()
  await chooseFile(wrapper, '楓.wav')
  // Act
  await wrapper.get('[aria-label="Remove file"]').trigger('click')
  // Assert
  expect(wrapper.get('.drop-zone').text()).toContain('Choose a WAV file')
  expect(wrapper.find('[data-test=start-transcription]').exists()).toBe(false)
  expect(wrapper.find('[aria-label="Remove file"]').exists()).toBe(false)
  expect(fetchMock).not.toHaveBeenCalled()
  wrapper.unmount()
})

test('test_AudioScoreWorkspace_when_drag_leaves_picker_then_clears_highlight', async () => {
  // Arrange
  const wrapper = await mountAudio()
  await wrapper.get('.drop-zone').trigger('dragover')
  expect(wrapper.get('.drop-zone').classes()).toContain('dragging')
  // Act: the full-area input receives the leave event, not the outer border.
  await wrapper.get('input[type=file]').trigger('dragleave', { relatedTarget: null })
  // Assert
  expect(wrapper.get('.drop-zone').classes()).not.toContain('dragging')
  wrapper.unmount()
})

test('test_AudioScoreWorkspace_when_busy_then_blocks_replacement_and_removal', async () => {
  // Arrange
  sessionStorage.setItem('audio-score-job', 'job-1')
  fetchMock.mockResolvedValue({ id: 'job-1', title: '楓', status: 'running', stage: 'separate-piano' })
  const wrapper = await mountAudio()
  await flushPromises()
  // Act
  await wrapper.get('.drop-zone').trigger('drop', {
    dataTransfer: { files: [new File(['RIFF0000WAVEtest'], 'replacement.wav')] },
  })
  // Assert
  expect(wrapper.get('[data-test=start-transcription]').attributes('disabled')).toBeDefined()
  expect(wrapper.find('[aria-label="Remove file"]').exists()).toBe(false)
  expect(wrapper.get('.file-info').text()).toContain('楓.wav')
  wrapper.unmount()
})

test('test_AudioScoreWorkspace_when_upload_fails_then_shows_error_and_allows_retry', async () => {
  // Arrange
  fetchMock.mockRejectedValue({ data: { message: 'Another transcription is running.' } })
  const wrapper = await mountAudio()
  await chooseFile(wrapper, '楓.wav')
  // Act
  await wrapper.get('[data-test=start-transcription]').trigger('click')
  await flushPromises()
  // Assert
  expect(wrapper.get('[role=alert]').text()).toContain('Another transcription')
  expect(wrapper.get('[data-test=start-transcription]').attributes('disabled')).toBeUndefined()
  expect(fetchMock).toHaveBeenCalledWith('/api/audio-scores', expect.objectContaining({
    method: 'POST', headers: { 'Content-Type': 'audio/wav', 'X-Audio-Filename': encodeURIComponent('楓.wav') },
  }))
  wrapper.unmount()
})

test('test_AudioScoreWorkspace_when_existing_job_restored_then_displays_actual_stage_and_can_cancel', async () => {
  // Arrange
  sessionStorage.setItem('audio-score-job', 'job-1')
  fetchMock.mockResolvedValue({ id: 'job-1', title: '楓', status: 'running', stage: 'separate-piano' })
  const wrapper = await mountAudio()
  await flushPromises()
  // Act
  const cancel = wrapper.findAll('button').find(button => button.text() === 'Cancel')!
  await cancel.trigger('click')
  await flushPromises()
  // Assert
  expect(wrapper.get('[role=status]').text()).toContain('Separating piano')
  expect(fetchMock).toHaveBeenCalledWith('/api/audio-scores/job-1', expect.objectContaining({ method: 'DELETE' }))
  wrapper.unmount()
})

test('test_AudioScoreWorkspace_when_poll_connection_fails_then_keeps_active_job_recoverable', async () => {
  // Arrange
  sessionStorage.setItem('audio-score-job', 'job-1')
  fetchMock.mockRejectedValue(new Error('network disconnected'))
  const wrapper = await mountAudio()
  await flushPromises()
  // Assert
  expect(wrapper.text()).toContain('Reconnect')
  expect(wrapper.text()).toContain('Cancel')
  expect(wrapper.text()).not.toContain('New Upload')
  expect(sessionStorage.getItem('audio-score-job')).toBe('job-1')
  wrapper.unmount()
})

test('test_AudioScoreWorkspace_when_saved_job_no_longer_exists_then_allows_new_upload', async () => {
  // Arrange
  sessionStorage.setItem('audio-score-job', 'missing')
  fetchMock.mockRejectedValue({ statusCode: 404, data: { message: 'Job not found. Please upload again.' } })
  const wrapper = await mountAudio()
  await flushPromises()
  // Act
  await chooseFile(wrapper, 'new.wav')
  // Assert
  expect(wrapper.get('[data-test=start-transcription]').attributes('disabled')).toBeUndefined()
  expect(sessionStorage.getItem('audio-score-job')).toBeNull()
  wrapper.unmount()
})

test.each(['failed', 'cancelled'])('test_AudioScoreWorkspace_when_restored_job_is_%s_then_can_clear_and_choose_again', async status => {
  // Arrange
  sessionStorage.setItem('audio-score-job', 'old-job')
  fetchMock.mockResolvedValue({ id: 'old-job', title: 'Old song', status, stage: 'transcribe-midi' })
  const wrapper = await mountAudio()
  await flushPromises()
  // Act
  await wrapper.get('[aria-label="Remove file"]').trigger('click')
  await chooseFile(wrapper, 'new.wav')
  // Assert
  expect(wrapper.get('.file-info').text()).toContain('new.wav')
  expect(wrapper.get('[data-test=start-transcription]').attributes('disabled')).toBeUndefined()
  expect(sessionStorage.getItem('audio-score-job')).toBeNull()
  wrapper.unmount()
})
