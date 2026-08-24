import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import type { ScoreVersion } from '../shared/arrangement/types'
import {
  verifyScoreNotation,
  verifyScorePlayback,
} from '../shared/audio-transcription/scoreVerification'
import type { TranscribedNote, TranscribedPedalEvent } from '../shared/audio-transcription/types'

type VerificationCase = {
  name: string
  referenceAudio: string
}

type MidiNotesFile = {
  notes: TranscribedNote[]
  pedalEvents: TranscribedPedalEvent[]
}

type StructureFile = {
  beats: number[]
  downbeats: number[]
}

type ScoreFile = {
  tempo: number
  version: ScoreVersion
}

const projectDirectory = resolve(import.meta.dirname, '..')
const execFileAsync = promisify(execFile)
const verificationCases: VerificationCase[] = [
  { name: '安靜', referenceAudio: '安靜-piano-reference.wav' },
  { name: '楓', referenceAudio: '楓-piano-reference.wav' },
]

export async function runAudioScoreVerification(): Promise<void> {
  const results = []
  for (const testCase of verificationCases) {
    results.push(await verifyCase(testCase))
  }
  console.log(JSON.stringify(results, null, 2))

  if (results.some(result => !result.ok)) {
    throw new Error('Audio score verification failed')
  }
}

async function verifyCase(testCase: VerificationCase) {
  const outputDirectory = resolve(projectDirectory, '.audio-score', testCase.name)
  const [referenceHash, pianoHash, score, notes, structure] = await Promise.all([
    hashDecodedAudio(resolve(projectDirectory, testCase.referenceAudio)),
    hashDecodedAudio(resolve(outputDirectory, 'piano.wav')),
    readJson<ScoreFile>(resolve(outputDirectory, 'score.json')),
    readJson<MidiNotesFile>(resolve(outputDirectory, 'work', 'notes.json')),
    readJson<StructureFile>(resolve(outputDirectory, 'work', 'structure', 'normalized.json')),
  ])
  const originSeconds = structure.downbeats[0] ?? structure.beats[0] ?? 0
  const playback = verifyScorePlayback({
    version: score.version,
    bpm: score.tempo,
    originSeconds,
    beatSeconds: structure.beats,
    notes: notes.notes,
    pedalEvents: notes.pedalEvents,
  })
  const notation = verifyScoreNotation(score.version)
  const separationMatchesReference = referenceHash === pianoHash
  const visual = await verifyViewer(resolve(outputDirectory, 'index.html'))

  return {
    name: testCase.name,
    ok: separationMatchesReference
      && notation.issues.length === 0
      && playback.issues.length === 0
      && visual.ok,
    separationMatchesReference,
    notationIssues: notation.issues,
    playbackIssues: playback.issues,
    visualVerification: visual,
  }
}

async function verifyViewer(viewerPath: string): Promise<{ ok: boolean, error?: string }> {
  try {
    await execFileAsync('npm', [
      'run',
      'test:e2e',
      '--',
      'tests/e2e/audio-score-viewer.spec.ts',
    ], {
      cwd: projectDirectory,
      env: {
        ...process.env,
        AUDIO_SCORE_VIEWER_PATH: viewerPath,
        PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3200',
      },
    })
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function hashDecodedAudio(path: string): Promise<string> {
  const { stdout } = await execFileAsync('ffmpeg', [
    '-v', 'error',
    '-i', path,
    '-map', '0:a:0',
    '-f', 'md5',
    '-',
  ])
  return stdout.trim()
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runAudioScoreVerification().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
