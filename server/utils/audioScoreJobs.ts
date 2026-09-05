import { resolve } from 'node:path'
import { createAudioScoreJobs } from '../services/audioScoreJobs'
import { createAudioScoreWorker } from '../services/audioScoreWorker'

const state = globalThis as typeof globalThis & {
  audioScoreJobs?: ReturnType<typeof createAudioScoreJobs>
}

export function audioScoreJobs() {
  return state.audioScoreJobs ??= createAudioScoreJobs({
    root: resolve(process.cwd(), '.data/audio-scores'),
    worker: createAudioScoreWorker(process.cwd()),
  })
}
