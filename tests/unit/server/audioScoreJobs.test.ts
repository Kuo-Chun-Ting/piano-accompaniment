import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test, vi } from 'vitest'
import { createAudioScoreJobs, type AudioScoreWorker } from '../../../server/services/audioScoreJobs'

const directories: string[] = []
const wav = Buffer.from('RIFF0000WAVEtest')
const score = {
  title: 'Test', tempo: 72,
  version: { level: 'rich', measures: [{
    index: 1, sectionId: 'a', sectionLabel: 'A', chordSymbols: [], lyrics: [], intensity: 'soft',
    staves: ['treble', 'bass'].map(id => ({ id, clef: id, voices: [{ id: '1', events: [
      { startBeat: 1, durationBeats: 4, notes: [{ pitch: 'C4' }] },
    ] }] })),
  }] },
  referenceAudio: { src: 'piano.wav', sourceBpm: 72, scoreStartSeconds: 2, beatSeconds: [2, 3] },
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

async function createJobs(worker: AudioScoreWorker, maxBytes = 1024) {
  const root = await mkdtemp(join(tmpdir(), 'audio-jobs-test-'))
  directories.push(root)
  return createAudioScoreJobs({ root, worker, maxBytes })
}

test('test_submit_when_valid_wav_then_reports_progress_and_serves_validated_result', async () => {
  // Arrange
  const jobs = await createJobs(async ({ outputDirectory, onStage }) => {
    onStage('transcribe-midi')
    await mkdir(outputDirectory, { recursive: true })
    await writeFile(join(outputDirectory, 'score.json'), JSON.stringify(score))
    await writeFile(join(outputDirectory, 'piano.wav'), wav)
  })
  // Act
  const job = await jobs.submit('楓.wav', [wav])
  await vi.waitFor(() => expect(jobs.get(job.id).status).toBe('succeeded'))
  // Assert
  expect(jobs.get(job.id).result?.title).toBe('楓')
  expect(jobs.get(job.id).result?.referenceAudio).toEqual({
    ...score.referenceAudio, src: `/api/audio-scores/${job.id}/audio`,
  })
  expect(await jobs.audioPath(job.id)).toContain(job.id)
})

test.each(['../escape.wav', 'x.mp3', '.wav', 'a\\b.wav'])('test_submit_when_filename_is_%s_then_rejects_before_running', async (name) => {
  // Arrange
  const worker = vi.fn()
  const jobs = await createJobs(worker)
  // Act & Assert
  await expect(jobs.submit(name, [wav])).rejects.toMatchObject({ statusCode: 400 })
  expect(worker).not.toHaveBeenCalled()
})

test.each([Buffer.from('not a wav'), Buffer.alloc(40)])('test_submit_when_invalid_or_oversized_data_then_releases_capacity', async (bytes) => {
  // Arrange
  const worker = vi.fn().mockRejectedValue(new Error('model failed'))
  const jobs = await createJobs(worker, 30)
  // Act & Assert
  await expect(jobs.submit('x.wav', [bytes])).rejects.toMatchObject({ statusCode: expect.any(Number) })
  const retry = await jobs.submit('x.wav', [wav])
  await vi.waitFor(() => expect(jobs.get(retry.id).status).toBe('failed'))
})

test('test_submit_when_worker_fails_then_exposes_safe_error_and_allows_retry', async () => {
  // Arrange
  const jobs = await createJobs(async () => { throw new Error('/private/model/path') })
  // Act
  const job = await jobs.submit('x.wav', [wav])
  await vi.waitFor(() => expect(jobs.get(job.id).status).toBe('failed'))
  // Assert
  expect(jobs.get(job.id).error).not.toContain('/private')
  await expect(jobs.audioPath(job.id)).rejects.toMatchObject({ statusCode: 409 })
  await expect(jobs.submit('x.wav', [wav])).resolves.toHaveProperty('id')
})

test('test_cancel_when_processing_then_aborts_worker_without_publishing_partial_score', async () => {
  // Arrange
  const worker: AudioScoreWorker = ({ signal, onStage }) => new Promise((resolve) => {
    onStage('separate-piano')
    signal.addEventListener('abort', () => resolve(), { once: true })
  })
  const jobs = await createJobs(worker)
  const job = await jobs.submit('x.wav', [wav])
  expect(jobs.get(job.id).stage).toBe('separate-piano')
  await expect(jobs.submit('another.wav', [wav])).rejects.toMatchObject({ statusCode: 409 })
  // Act
  jobs.cancel(job.id)
  // Assert
  await vi.waitFor(() => expect(jobs.get(job.id).status).toBe('cancelled'))
  expect(jobs.get(job.id).result).toBeUndefined()
})

test('test_get_when_unknown_id_then_returns_not_found', async () => {
  // Arrange
  const jobs = await createJobs(vi.fn())
  // Act & Assert
  expect(() => jobs.get('../x')).toThrowError(expect.objectContaining({ statusCode: 404 }))
})

test('test_submit_when_worker_exits_without_complete_artifacts_then_marks_job_failed', async () => {
  // Arrange
  const jobs = await createJobs(async () => {})
  // Act
  const job = await jobs.submit('empty.wav', [wav])
  // Assert
  await vi.waitFor(() => expect(jobs.get(job.id).status).toBe('failed'))
  expect(jobs.get(job.id).result).toBeUndefined()
})

test('test_submit_when_processing_times_out_then_aborts_worker_and_reports_failure', async () => {
  // Arrange
  const worker: AudioScoreWorker = ({ signal }) => new Promise(resolve => signal.addEventListener('abort', () => resolve()))
  const jobs = await createJobs(worker)
  vi.useFakeTimers()
  try {
    const job = await jobs.submit('long.wav', [wav])
    // Act
    await vi.advanceTimersByTimeAsync(30 * 60 * 1000)
    // Assert
    expect(jobs.get(job.id).status).toBe('failed')
    expect(jobs.get(job.id).error).toContain('30 minutes')
  } finally { vi.useRealTimers() }
})
