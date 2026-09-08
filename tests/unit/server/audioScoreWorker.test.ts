import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, expect, test, vi } from 'vitest'
import {
  buildAudioScoreWorkerCommand,
  createAudioScoreWorker,
} from '../../../server/services/audioScoreWorker'

const paths: string[] = []
const worker = createAudioScoreWorker(resolve('tests/fixtures/audio-worker'))
afterEach(async () => { await Promise.all(paths.splice(0).map(path => rm(path, { force: true, recursive: true }))) })

async function inputPath(name: string) {
  const directory = await mkdtemp(join(tmpdir(), 'audio-worker-test-'))
  paths.push(directory)
  return { inputPath: join(directory, name), outputDirectory: directory, directory }
}

test('test_audioScoreWorker_when_cli_succeeds_then_reports_chunked_stages_and_keeps_log', async () => {
  // Arrange
  const input = await inputPath('楓 with spaces.wav')
  const onStage = vi.fn()
  // Act
  await worker({ ...input, signal: new AbortController().signal, onStage })
  // Assert
  expect(onStage).toHaveBeenCalledWith('transcribe-midi')
  await vi.waitFor(async () => expect(await readFile(join(input.directory, 'pipeline.log'), 'utf8')).toContain('Fixture diagnostic'))
})

test('test_buildAudioScoreWorkerCommand_when_development_then_runs_source_without_viewer', () => {
  // Arrange
  const projectDirectory = '/project'
  const input = '/data/song.wav'

  // Act
  const command = buildAudioScoreWorkerCommand(projectDirectory, input, false)

  // Assert
  expect(command).toEqual({
    cwd: projectDirectory,
    args: ['--import', 'tsx', 'scripts/audio-score.ts', input, '--skip-viewer'],
  })
})

test('test_buildAudioScoreWorkerCommand_when_production_then_runs_bundled_pipeline_without_viewer', () => {
  // Arrange
  const projectDirectory = '/project'
  const input = '/data/song.wav'

  // Act
  const command = buildAudioScoreWorkerCommand(projectDirectory, input, true)

  // Assert
  expect(command).toEqual({
    cwd: projectDirectory,
    args: ['/project/.output/audio-score.mjs', input, '--skip-viewer'],
  })
})

test('test_audioScoreWorker_when_cli_exits_nonzero_then_rejects', async () => {
  // Arrange
  const input = await inputPath('fail.wav')
  // Act & Assert
  await expect(worker({ ...input, signal: new AbortController().signal, onStage: vi.fn() })).rejects.toThrow('code 1')
})

test.skipIf(process.platform === 'win32')('test_audioScoreWorker_when_cancelled_then_stops_cli_and_model_descendant', async () => {
  // Arrange
  const input = await inputPath('cancel.wav')
  const controller = new AbortController()
  const onStage = vi.fn()
  const completion = worker({ ...input, signal: controller.signal, onStage }).catch(error => error)
  await vi.waitFor(() => expect(onStage).toHaveBeenCalledWith('separate-piano'))
  const pids: number[] = JSON.parse(await readFile(join(input.directory, 'pids.json'), 'utf8'))
  // Act
  controller.abort()
  // Assert
  expect(await completion).toBeInstanceOf(Error)
  await vi.waitFor(() => {
    for (const pid of pids) expect(() => process.kill(pid, 0)).toThrow()
  }, { timeout: 5000 })
})
