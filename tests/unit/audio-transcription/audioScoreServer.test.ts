import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, expect, test } from 'vitest'

import { startAudioScoreServer, type RunningAudioScoreServer } from '../../../scripts/audio-score-server'

const temporaryDirectories: string[] = []
const runningServers: RunningAudioScoreServer[] = []

afterEach(async () => {
  await Promise.all(runningServers.splice(0).map(server => server.close()))
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { force: true, recursive: true })))
})

test('test_startAudioScoreServer_when_requesting_file_then_returns_complete_content', async () => {
  // Arrange
  const rootDirectory = await createTemporaryRoot()
  await writeFile(join(rootDirectory, 'index.html'), '<h1>Score</h1>')
  const server = await startTestServer(rootDirectory)

  // Act
  const response = await fetch(`${server.origin}/index.html`)

  // Assert
  expect(response.status).toBe(200)
  expect(response.headers.get('accept-ranges')).toBe('bytes')
  expect(await response.text()).toBe('<h1>Score</h1>')
})

test('test_startAudioScoreServer_when_requesting_byte_range_then_returns_partial_content', async () => {
  // Arrange
  const rootDirectory = await createTemporaryRoot()
  await writeFile(join(rootDirectory, 'piano.wav'), Buffer.from('0123456789'))
  const server = await startTestServer(rootDirectory)

  // Act
  const response = await fetch(`${server.origin}/piano.wav`, {
    headers: { Range: 'bytes=3-6' },
  })

  // Assert
  expect(response.status).toBe(206)
  expect(response.headers.get('content-range')).toBe('bytes 3-6/10')
  expect(response.headers.get('content-length')).toBe('4')
  expect(await response.text()).toBe('3456')
})

async function createTemporaryRoot(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'audio-score-server-'))
  temporaryDirectories.push(directory)
  return directory
}

async function startTestServer(rootDirectory: string): Promise<RunningAudioScoreServer> {
  const server = await startAudioScoreServer({ host: '127.0.0.1', port: 0, rootDirectory })
  runningServers.push(server)
  return server
}
