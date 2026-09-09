import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { afterEach, expect, test } from 'vitest'

const execFileAsync = promisify(execFile)
const temporaryDirectories: string[] = []
const script = resolve('scripts/audio-score/prepare-models.py')

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory =>
    rm(directory, { recursive: true, force: true })))
})

test('test_prepareModels_when_cache_is_missing_then_downloads_before_starting_command', async () => {
  // Arrange
  const fixture = await createFixture()
  const marker = join(fixture.directory, 'started')

  // Act
  await runSetup(fixture, ['python3', '-c',
    `import os; from pathlib import Path; assert os.environ['HF_HUB_OFFLINE'] == '1'; assert Path(${JSON.stringify(join(fixture.models, 'weights/model.bin'))}).read_text() == 'model parameters'; Path(${JSON.stringify(marker)}).touch()`])

  // Assert
  expect(await readFile(join(fixture.models, 'weights/model.bin'), 'utf8')).toBe('model parameters')
  expect(await readFile(marker, 'utf8')).toBe('')
})

test('test_prepareModels_when_cache_is_valid_then_restarts_without_downloading', async () => {
  // Arrange
  const fixture = await createFixture()
  await runSetup(fixture)
  await rm(fixture.source)

  // Act
  const result = await runSetup(fixture)

  // Assert
  expect(result.stdout).toContain('Models ready')
  expect(result.stdout).not.toContain('Downloading')
})

test('test_prepareModels_when_cached_file_is_corrupt_then_replaces_it', async () => {
  // Arrange
  const fixture = await createFixture()
  await runSetup(fixture)
  await writeFile(join(fixture.models, 'weights/model.bin'), 'corrupt')

  // Act
  await runSetup(fixture)

  // Assert
  expect(await readFile(join(fixture.models, 'weights/model.bin'), 'utf8')).toBe('model parameters')
})

test('test_prepareModels_when_download_checksum_is_wrong_then_fails_without_starting_command', async () => {
  // Arrange
  const fixture = await createFixture()
  await writeFile(fixture.source, 'truncated download')
  const marker = join(fixture.directory, 'started')

  // Act & Assert
  await expect(runSetup(fixture, ['python3', '-c',
    `from pathlib import Path; Path(${JSON.stringify(marker)}).touch()`]))
    .rejects.toMatchObject({ code: 1, stderr: expect.stringContaining('SHA256 mismatch') })
  expect(await readdir(join(fixture.models, 'weights'))).toEqual([])
  await expect(readFile(marker)).rejects.toMatchObject({ code: 'ENOENT' })
})

test('test_prepareModels_when_download_is_unavailable_then_fails_and_can_retry', async () => {
  // Arrange
  const fixture = await createFixture()
  await rm(fixture.source)

  // Act & Assert
  await expect(runSetup(fixture)).rejects.toMatchObject({
    code: 1, stderr: expect.stringContaining('Model setup failed'),
  })
  await writeFile(fixture.source, 'model parameters')
  await runSetup(fixture)
  expect(await readFile(join(fixture.models, 'weights/model.bin'), 'utf8')).toBe('model parameters')
})

test('test_prepareModels_when_manifest_escapes_model_directory_then_rejects_it', async () => {
  // Arrange
  const fixture = await createFixture()
  await writeFile(fixture.manifest, JSON.stringify({ files: [{
    path: '../outside.bin', url: pathToFileURL(fixture.source).href, sha256: hash('model parameters'),
  }], references: [] }))

  // Act & Assert
  await expect(runSetup(fixture)).rejects.toMatchObject({
    code: 1, stderr: expect.stringContaining('outside model directory'),
  })
  await expect(readFile(join(fixture.directory, 'outside.bin'))).rejects.toMatchObject({ code: 'ENOENT' })
})

test('test_prepareModels_when_download_succeeds_then_publishes_pinned_cache_reference', async () => {
  // Arrange
  const fixture = await createFixture()
  await writeFile(fixture.manifest, JSON.stringify({ files: [{
    path: 'snapshots/revision/model.bin', url: pathToFileURL(fixture.source).href, sha256: hash('model parameters'),
  }], references: [{ path: 'refs/main', revision: 'revision' }] }))

  // Act
  await runSetup(fixture)

  // Assert
  expect(await readFile(join(fixture.models, 'refs/main'), 'utf8')).toBe('revision')
})

test('test_prepareModels_when_download_fails_then_preserves_previous_cache_reference', async () => {
  // Arrange
  const fixture = await createFixture()
  await mkdir(join(fixture.models, 'refs'), { recursive: true })
  await writeFile(join(fixture.models, 'refs/main'), 'previous')
  await writeFile(fixture.manifest, JSON.stringify({ files: [{
    path: 'snapshots/revision/model.bin', url: pathToFileURL(fixture.source).href, sha256: hash('wrong'),
  }], references: [{ path: 'refs/main', revision: 'revision' }] }))

  // Act & Assert
  await expect(runSetup(fixture)).rejects.toMatchObject({ code: 1 })
  expect(await readFile(join(fixture.models, 'refs/main'), 'utf8')).toBe('previous')
})

type Fixture = { directory: string; source: string; manifest: string; models: string }

async function createFixture(): Promise<Fixture> {
  const directory = await mkdtemp(join(tmpdir(), 'prepare-models-test-'))
  temporaryDirectories.push(directory)
  const fixture = {
    directory, source: join(directory, 'source.bin'),
    manifest: join(directory, 'manifest.json'), models: join(directory, 'models'),
  }
  await writeFile(fixture.source, 'model parameters')
  await writeFile(fixture.manifest, JSON.stringify({ files: [{
    path: 'weights/model.bin', url: pathToFileURL(fixture.source).href, sha256: hash('model parameters'),
  }], references: [] }))
  return fixture
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function runSetup(fixture: Fixture, command: string[] = []): ReturnType<typeof execFileAsync> {
  return execFileAsync('python3', [script, '--models-dir', fixture.models,
    '--manifest', fixture.manifest, '--', ...command])
}
