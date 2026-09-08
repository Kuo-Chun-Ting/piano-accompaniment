import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, expect, test } from 'vitest'

const execFileAsync = promisify(execFile)
const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, {
    force: true,
    recursive: true,
  })))
})

test('test_audioScoreProductionBuild_when_bundled_then_runs_without_node_modules', async () => {
  // Arrange
  const projectDirectory = resolve('.')
  const isolatedDirectory = await mkdtemp(join(tmpdir(), 'audio-score-production-'))
  temporaryDirectories.push(isolatedDirectory)
  await execFileAsync('npm', ['run', 'build:audio-score'], { cwd: projectDirectory })
  await mkdir(join(isolatedDirectory, '.output'))
  const bundle = await readFile(join(projectDirectory, '.output/audio-score.mjs'))
  await writeFile(join(isolatedDirectory, '.output/audio-score.mjs'), bundle)

  // Act
  const result = await execFileAsync(
    process.execPath,
    [join(isolatedDirectory, '.output/audio-score.mjs')],
    { cwd: isolatedDirectory },
  ).then(
    () => ({ exitCode: 0, stderr: '' }),
    (error: { code: number, stderr: string }) => ({
      exitCode: error.code,
      stderr: error.stderr,
    }),
  )

  // Assert
  expect(result).toMatchObject({
    exitCode: 1,
    stderr: expect.stringContaining('Usage: npm run audio:score'),
  })
  expect(result.stderr).not.toContain('ERR_MODULE_NOT_FOUND')
}, 15_000)
