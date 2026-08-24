import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { execFileSync, spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { performance } from 'node:perf_hooks'
import { parseAudioScoreArgs } from '../shared/audio-transcription/cli'
import { convertTranscriptionToScore } from '../shared/audio-transcription/midiToScore'
import {
  buildAudioScorePipeline,
  resolveAudioScorePaths,
  type PipelineCommand,
} from '../shared/audio-transcription/pipeline'
import { getRequiredModelArtifacts } from '../shared/audio-transcription/runtime'
import type {
  TranscribedLyricSegment,
  TranscribedNote,
  TranscribedPedalEvent,
} from '../shared/audio-transcription/types'
import { parseViewerData } from '../tools/audio-score-viewer/viewerData'

type MidiNotesFile = {
  durationSeconds: number
  notes: TranscribedNote[]
  pedalEvents: TranscribedPedalEvent[]
  validation: {
    unmatchedNoteOff: number
    stuckNoteOn: number
  }
}

type StructureFile = {
  bpm: number
  beats: number[]
  downbeats: number[]
}

type LyricsFile = {
  language: string
  languageProbability: number
  segments: TranscribedLyricSegment[]
}

type StageResult = {
  stage: string
  durationSeconds: number
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const projectDirectory = resolve(scriptDirectory, '..')

export async function runAudioScoreCli(args = process.argv.slice(2)): Promise<void> {
  const options = parseAudioScoreArgs(args)
  await assertFile(options.inputPath, 'WAV input')
  await assertFile(options.pythonExecutable, 'Python executable')
  await assertDirectory(options.modelsDirectory, 'Audio-score models directory')
  for (const artifact of getRequiredModelArtifacts(options.modelsDirectory)) {
    if (artifact.kind === 'file') {
      await assertFile(artifact.path, artifact.label)
    } else {
      await assertDirectory(artifact.path, artifact.label)
    }
  }

  const paths = resolveAudioScorePaths(options.outputDirectory)
  await Promise.all([
    mkdir(paths.outputDirectory, { recursive: true }),
    mkdir(paths.normalizedInputDirectory, { recursive: true }),
    mkdir(paths.stemsDirectory, { recursive: true }),
    mkdir(paths.structureDirectory, { recursive: true }),
    mkdir(paths.demixDirectory, { recursive: true }),
    mkdir(paths.spectrogramDirectory, { recursive: true }),
  ])

  const stages: StageResult[] = []
  stages.push(await runCommand({
    stage: 'check-environment',
    executable: options.pythonExecutable,
    args: [resolve(projectDirectory, 'scripts/audio-score/check-environment.py')],
  }))

  const caFile = execFileSync(options.pythonExecutable, [
    '-c',
    'import certifi; print(certifi.where())',
  ], { encoding: 'utf8' }).trim()
  await assertFile(caFile, 'Python CA certificate')

  const pipeline = buildAudioScorePipeline({
    ...options,
    projectDirectory,
    caFile,
  })

  for (const command of pipeline) {
    stages.push(await runCommand(command))
  }

  await copyFile(paths.pianoStem, paths.pianoAudio)
  const notesFile = parseMidiNotes(await readJson(paths.notes))
  const structureFile = parseStructure(await readJson(paths.structure))
  const lyricsFile = parseLyrics(await readJson(paths.lyrics))
  const firstDownbeatSeconds = structureFile.downbeats[0] ?? structureFile.beats[0] ?? 0
  const version = convertTranscriptionToScore({
    notes: notesFile.notes,
    pedalEvents: notesFile.pedalEvents,
    lyricSegments: lyricsFile.segments,
    bpm: structureFile.bpm,
    durationSeconds: notesFile.durationSeconds,
    firstDownbeatSeconds,
    downbeatSeconds: structureFile.downbeats,
    measureCount: structureFile.downbeats.length || undefined,
  })
  const scoreData = parseViewerData({
    title: options.title,
    tempo: structureFile.bpm,
    version,
    pianoAudio: 'piano.wav',
  })
  const renderedNoteEvents = version.measures.flatMap(measure => measure.staves.flatMap(staff =>
    staff.voices.flatMap(voice => voice.events)))
    .filter(event => event.notes.length > 0)

  if (renderedNoteEvents.length === 0) {
    throw new Error('Transcription produced no playable score events')
  }

  await writeJson(paths.score, scoreData)
  stages.push(await runCommand({
    stage: 'build-viewer',
    executable: 'npm',
    args: ['run', 'audio:score:viewer'],
    environment: {
      AUDIO_SCORE_DATA: paths.score,
      AUDIO_SCORE_VIEWER_OUT: paths.outputDirectory,
    },
  }, projectDirectory))
  await assertFile(paths.viewer, 'Interactive score viewer')
  await writeJson(paths.report, {
    input: options.inputPath,
    outputDirectory: options.outputDirectory,
    tempo: structureFile.bpm,
    beats: structureFile.beats.length,
    downbeats: structureFile.downbeats.length,
    measures: version.measures.length,
    midiNotes: notesFile.notes.length,
    pedalEvents: notesFile.pedalEvents.length,
    pedalIntervals: version.pedalIntervals?.length ?? 0,
    lyricLanguage: lyricsFile.language,
    lyricLanguageProbability: lyricsFile.languageProbability,
    lyricSegments: lyricsFile.segments.length,
    renderedNoteEvents: renderedNoteEvents.length,
    midiValidation: notesFile.validation,
    stages,
    warnings: [
      'AI transcription requires listening review because no ground-truth score is available.',
      'TransKun 2.0.1 uses deprecated pkg_resources; setuptools is pinned below version 81.',
    ],
  })

  console.log(JSON.stringify({
    ok: true,
    viewer: paths.viewer,
    score: paths.score,
    pianoAudio: paths.pianoAudio,
    midi: paths.midi,
    report: paths.report,
  }, null, 2))
}

async function runCommand(command: PipelineCommand, cwd = projectDirectory): Promise<StageResult> {
  console.log(`\n→ ${command.stage}`)
  const startedAt = performance.now()

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(command.executable, command.args, {
      cwd,
      env: { ...process.env, ...command.environment },
      stdio: 'inherit',
    })

    child.on('error', error => rejectPromise(
      new Error(`${command.stage} could not start: ${error.message}`),
    ))
    child.on('close', (exitCode) => {
      if (exitCode === 0) {
        resolvePromise()
      } else {
        rejectPromise(new Error(`${command.stage} failed with exit code ${exitCode}`))
      }
    })
  })

  return {
    stage: command.stage,
    durationSeconds: roundSeconds((performance.now() - startedAt) / 1000),
  }
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8'))
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function parseMidiNotes(value: unknown): MidiNotesFile {
  const candidate = value as Partial<MidiNotesFile>
  if (!Number.isFinite(candidate.durationSeconds)
    || !Array.isArray(candidate.notes)
    || candidate.notes.length === 0
    || !Array.isArray(candidate.pedalEvents)
    || !candidate.validation
    || candidate.validation.unmatchedNoteOff !== 0
    || candidate.validation.stuckNoteOn !== 0) {
    throw new Error('MIDI note export is invalid or contains unpaired notes')
  }
  return candidate as MidiNotesFile
}

function parseStructure(value: unknown): StructureFile {
  const candidate = value as Partial<StructureFile>
  if (!Number.isInteger(candidate.bpm)
    || (candidate.bpm ?? 0) <= 0
    || !isIncreasingNumberArray(candidate.beats)
    || !isIncreasingNumberArray(candidate.downbeats)) {
    throw new Error('Beat analysis is invalid')
  }
  return candidate as StructureFile
}

function parseLyrics(value: unknown): LyricsFile {
  const candidate = value as Partial<LyricsFile>
  if (typeof candidate.language !== 'string'
    || !Number.isFinite(candidate.languageProbability)
    || !Array.isArray(candidate.segments)
    || candidate.segments.some(segment => !isValidLyricSegment(segment))) {
    throw new Error('Lyric transcription is invalid')
  }
  return candidate as LyricsFile
}

function isValidLyricSegment(segment: TranscribedLyricSegment): boolean {
  return Number.isFinite(segment.startSeconds)
    && Number.isFinite(segment.endSeconds)
    && segment.endSeconds > segment.startSeconds
    && typeof segment.text === 'string'
    && segment.text.trim().length > 0
}

function isIncreasingNumberArray(value: unknown): value is number[] {
  return Array.isArray(value)
    && value.length > 0
    && value.every((item, index) => Number.isFinite(item)
      && (index === 0 || item > value[index - 1]!))
}

async function assertFile(path: string, label: string): Promise<void> {
  try {
    if (!(await stat(path)).isFile()) {
      throw new Error()
    }
  } catch {
    throw new Error(`${label} does not exist: ${path}`)
  }
}

async function assertDirectory(path: string, label: string): Promise<void> {
  try {
    if (!(await stat(path)).isDirectory()) {
      throw new Error()
    }
  } catch {
    throw new Error(`${label} does not exist: ${path}`)
  }
}

function roundSeconds(value: number): number {
  return Math.round(value * 100) / 100
}

if (process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runAudioScoreCli().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
