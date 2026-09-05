import { randomUUID } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, open, readFile, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createError } from 'h3'
import { MAX_AUDIO_UPLOAD_BYTES, type AudioScoreJob } from '../../shared/audio-transcription/job'
import { parseViewerData } from '../../tools/audio-score-viewer/viewerData'

export type AudioScoreWorker = (options: {
  inputPath: string
  outputDirectory: string
  signal: AbortSignal
  onStage: (stage: string) => void
}) => Promise<void>

interface JobRecord {
  state: AudioScoreJob
  directory: string
  outputDirectory: string
  controller: AbortController
}

interface JobOptions {
  root: string
  worker: AudioScoreWorker
  maxBytes?: number
}

export function createAudioScoreJobs(options: JobOptions) {
  const records = new Map<string, JobRecord>()
  let activeId: string | null = null

  function record(id: string): JobRecord {
    const value = records.get(id)
    if (!value) throw createError({ statusCode: 404, message: 'Job not found. Please upload again.' })
    return value
  }

  async function execute(job: JobRecord, inputPath: string): Promise<void> {
    const timer = setTimeout(() => job.controller.abort('timeout'), 30 * 60 * 1000)
    try {
      await options.worker({
        inputPath, outputDirectory: job.outputDirectory, signal: job.controller.signal,
        onStage: stage => { job.state.stage = stage },
      })
      if (job.controller.signal.aborted) return
      job.state.result = await readResult(job)
      job.state.status = 'succeeded'
    } catch (error) {
      if (!job.controller.signal.aborted) {
        console.error('[audio-score]', job.state.id, error)
        job.state.status = 'failed'
        job.state.error = 'Transcription failed. Check the local setup and server log, then retry.'
      }
    } finally {
      clearTimeout(timer)
      if (job.controller.signal.aborted) {
        delete job.state.result
        const timedOut = job.controller.signal.reason === 'timeout'
        job.state.status = timedOut ? 'failed' : 'cancelled'
        if (timedOut) job.state.error = 'Stopped after 30 minutes. Try a shorter recording.'
      }
      activeId = null
    }
  }

  async function submit(filename: string, source: Iterable<Uint8Array> | AsyncIterable<Uint8Array>): Promise<AudioScoreJob> {
    const title = validateFilename(filename)
    if (activeId) throw createError({ statusCode: 409, message: 'Another transcription is running. Please try later.' })
    const id = randomUUID()
    const directory = join(options.root, id)
    const job: JobRecord = {
      directory, outputDirectory: join(directory, '.audio-score', title),
      state: { id, title, status: 'uploading', stage: 'uploading' }, controller: new AbortController(),
    }
    activeId = id
    records.set(id, job)
    try {
      await mkdir(directory, { recursive: true })
      const inputPath = join(directory, `${title}.wav`)
      await saveUpload(source, inputPath, options.maxBytes ?? MAX_AUDIO_UPLOAD_BYTES)
      job.state.status = 'running'
      job.state.stage = 'starting'
      void execute(job, inputPath)
      return { ...job.state }
    } catch (error) {
      records.delete(id)
      activeId = null
      await rm(directory, { recursive: true, force: true })
      throw error
    }
  }

  return {
    submit,
    get: (id: string): AudioScoreJob => ({ ...record(id).state }),
    cancel: (id: string): void => {
      const job = record(id)
      if (job.state.status === 'running') job.controller.abort('cancelled')
    },
    close: (): void => { for (const job of records.values()) job.controller.abort('shutdown') },
    audioPath: async (id: string): Promise<string> => {
      const job = record(id)
      if (job.state.status !== 'succeeded') throw createError({ statusCode: 409, message: 'Transcription is not ready yet.' })
      return join(job.outputDirectory, 'piano.wav')
    },
  }
}

function validateFilename(filename: string): string {
  if (!filename.toLowerCase().endsWith('.wav') || /[/\\\x00-\x1f]/.test(filename) || filename.length > 120) {
    throw createError({ statusCode: 400, message: 'Choose a WAV file.' })
  }
  const title = filename.slice(0, -4).trim()
  if (!title || title === '.' || title === '..') throw createError({ statusCode: 400, message: 'A file name is required.' })
  return title
}

async function saveUpload(source: Iterable<Uint8Array> | AsyncIterable<Uint8Array>, path: string, maxBytes: number): Promise<void> {
  let size = 0
  const limit = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      size += chunk.length
      callback(size > maxBytes ? createError({ statusCode: 413, message: 'WAV files must be 100 MB or smaller.' }) : null, chunk)
    },
  })
  await pipeline(Readable.from(source), limit, createWriteStream(path, { flags: 'wx' }))
  const file = await open(path, 'r')
  try {
    const header = Buffer.alloc(12)
    const { bytesRead } = await file.read(header, 0, 12, 0)
    if (bytesRead !== 12 || !['RIFF', 'RF64'].includes(header.toString('ascii', 0, 4)) || header.toString('ascii', 8, 12) !== 'WAVE') {
      throw createError({ statusCode: 400, message: 'This file is not a valid WAV.' })
    }
  } finally { await file.close() }
}

async function readResult(job: JobRecord) {
  const result = parseViewerData(JSON.parse(await readFile(join(job.outputDirectory, 'score.json'), 'utf8')))
  if (!result.referenceAudio || (await stat(join(job.outputDirectory, 'piano.wav'))).size === 0) {
    throw new Error('Transcription did not produce reference audio')
  }
  return {
    ...result, title: job.state.title,
    referenceAudio: { ...result.referenceAudio, src: `/api/audio-scores/${job.state.id}/audio` },
  }
}
