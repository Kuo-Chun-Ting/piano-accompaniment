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

test.each([
  ['bytes=7-', 206, '789'], ['bytes=-3', 206, '789'],
  ['bytes=20-', 416, ''], ['bytes=5-2', 416, ''],
])('test_startAudioScoreServer_when_range_is_%s_then_returns_%s', async (range, status, body) => {
  // Arrange
  const rootDirectory = await createTemporaryRoot()
  await writeFile(join(rootDirectory, 'piano.wav'), '0123456789')
  const server = await startTestServer(rootDirectory)
  // Act
  const response = await fetch(`${server.origin}/piano.wav`, { headers: { Range: range } })
  // Assert
  expect(response.status).toBe(status)
  expect(await response.text()).toBe(body)
})

test('test_startAudioScoreServer_when_head_requested_then_returns_headers_without_body', async () => {
  // Arrange
  const rootDirectory = await createTemporaryRoot()
  await writeFile(join(rootDirectory, 'piano.wav'), '0123456789')
  const server = await startTestServer(rootDirectory)
  // Act
  const response = await fetch(`${server.origin}/piano.wav`, { method: 'HEAD' })
  // Assert
  expect(response.headers.get('content-length')).toBe('10')
  expect(await response.text()).toBe('')
})

test('test_startAudioScoreServer_when_empty_file_then_returns_empty_body_without_crashing', async () => {
  // Arrange
  const rootDirectory = await createTemporaryRoot()
  await writeFile(join(rootDirectory, 'empty.wav'), '')
  const server = await startTestServer(rootDirectory)
  // Act
  const response = await fetch(`${server.origin}/empty.wav`)
  // Assert
  expect(response.status).toBe(200)
  expect(await response.text()).toBe('')
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
