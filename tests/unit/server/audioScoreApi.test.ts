import { createServer, type Server } from 'node:http'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp, createRouter, toNodeListener } from 'h3'
import { afterEach, expect, test, vi } from 'vitest'
import upload from '../../../server/api/audio-scores/index.post'
import status from '../../../server/api/audio-scores/[id].get'
import audio from '../../../server/api/audio-scores/[id]/audio'
import { createAudioScoreJobs } from '../../../server/services/audioScoreJobs'
import { buildAudioScoreFixture, buildAudioWavFixture } from '../../fixtures/audioScore'

let server: Server | undefined
let root: string | undefined
const globals = globalThis as typeof globalThis & { audioScoreJobs?: ReturnType<typeof createAudioScoreJobs> }
afterEach(async () => {
  globals.audioScoreJobs?.close()
  delete globals.audioScoreJobs
  if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()))
  if (root) await rm(root, { recursive: true, force: true })
})

test('test_audioScoreApi_when_wav_uploaded_then_polls_result_and_serves_seekable_audio', async () => {
  // Arrange: real route handlers and filesystem, isolated model worker.
  root = await mkdtemp(join(tmpdir(), 'audio-api-test-'))
  const wav = buildAudioWavFixture(1)
  globals.audioScoreJobs = createAudioScoreJobs({ root, worker: async ({ outputDirectory }) => {
    await mkdir(outputDirectory, { recursive: true })
    await writeFile(join(outputDirectory, 'score.json'), JSON.stringify(buildAudioScoreFixture()))
    await writeFile(join(outputDirectory, 'piano.wav'), wav)
  } })
  const router = createRouter().post('/api/audio-scores', upload).get('/api/audio-scores/:id', status).get('/api/audio-scores/:id/audio', audio)
  server = createServer(toNodeListener(createApp().use(router)))
  await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  // Act
  const response = await fetch(`${origin}/api/audio-scores`, { method: 'POST', body: new Uint8Array(wav).buffer, headers: { 'Content-Type': 'audio/wav', 'X-Audio-Filename': encodeURIComponent('楓.wav') } })
  const job = await response.json()
  // Assert
  expect(response.status).toBe(202)
  await vi.waitFor(async () => expect((await (await fetch(`${origin}/api/audio-scores/${job.id}`)).json()).status).toBe('succeeded'))
  const part = await fetch(`${origin}/api/audio-scores/${job.id}/audio`, { headers: { Range: 'bytes=1000-1999' } })
  expect(part.status).toBe(206)
  expect(part.headers.get('content-range')).toBe(`bytes 1000-1999/${wav.length}`)
  expect(Buffer.from(await part.arrayBuffer())).toEqual(wav.subarray(1000, 2000))
  const unknown = await fetch(`${origin}/api/audio-scores/unknown/audio`)
  expect(unknown.status).toBe(404)
})
