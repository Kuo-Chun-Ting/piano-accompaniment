import { spawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { dirname, join } from 'node:path'
import type { AudioScoreWorker } from './audioScoreJobs'

/** Runs the same CLI used locally. Each job owns its process group and log. */
export function createAudioScoreWorker(projectDirectory: string): AudioScoreWorker {
  return ({ inputPath, signal, onStage }) => new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new Error('Cancelled')); return }
    const log = createWriteStream(join(dirname(inputPath), 'pipeline.log'))
    const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/audio-score.ts', inputPath], {
      cwd: projectDirectory, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
    })
    let pending = ''
    child.stdout.on('data', (chunk: Buffer) => {
      pending += chunk.toString()
      const lines = pending.split(/\r?\n/)
      pending = lines.pop() ?? ''
      for (const line of lines) {
        const stage = /^→ ([a-z-]+)$/.exec(line.trim())?.[1]
        if (stage) onStage(stage)
      }
      if (pending.length > 8192) pending = ''
    })
    child.stdout.pipe(log, { end: false })
    child.stderr.pipe(log, { end: false })
    log.on('error', error => { stop(); reject(error) })
    const stop = (): void => {
      if (!child.pid) return
      try {
        if (process.platform === 'win32') child.kill('SIGKILL')
        else process.kill(-child.pid, 'SIGKILL')
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') console.error('[audio-score:cancel]', error)
      }
    }
    signal.addEventListener('abort', stop, { once: true })
    child.once('error', reject)
    child.once('close', code => {
      signal.removeEventListener('abort', stop)
      log.end()
      if (code === 0 && !signal.aborted) resolve()
      else reject(new Error(`Transcription exited with code ${code}; see ${dirname(inputPath)}/pipeline.log`))
    })
  })
}
