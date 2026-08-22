import { homedir } from 'node:os'
import { basename, dirname, extname, join, resolve } from 'node:path'

export type AudioScoreCliOptions = {
  inputPath: string
  outputDirectory: string
  pythonExecutable: string
  modelsDirectory: string
  separationDevice: 'cpu' | 'mps'
  title: string
}

type ParseAudioScoreContext = {
  cwd: string
  runtimeDirectory: string
  platform: NodeJS.Platform
}

const USAGE = 'Usage: npm run audio:score -- <recording.wav>'

export function parseAudioScoreArgs(
  args: string[],
  context: ParseAudioScoreContext = {
    cwd: process.cwd(),
    runtimeDirectory: getDefaultRuntimeDirectory(process.platform),
    platform: process.platform,
  },
): AudioScoreCliOptions {
  const input = args[0]
  if (!input || input.startsWith('--')) {
    throw new Error(USAGE)
  }

  if (extname(input).toLowerCase() !== '.wav') {
    throw new Error(`Input must be a WAV file: ${input}`)
  }
  if (args.length !== 1) {
    throw new Error('Only one WAV recording path is accepted')
  }

  const inputPath = resolve(context.cwd, input)
  const defaultTitle = basename(inputPath, extname(inputPath))
  if (!defaultTitle.trim() || defaultTitle === '.' || defaultTitle === '..') {
    throw new Error('WAV filename must contain a usable score name')
  }
  const inputDirectory = dirname(inputPath)
  const workRoot = resolve(inputDirectory, '.audio-score')
  const outputDirectory = resolve(workRoot, defaultTitle)
  if (dirname(outputDirectory) !== workRoot) {
    throw new Error('WAV filename must contain a usable score name')
  }
  const pythonExecutable = context.platform === 'win32'
    ? join(context.runtimeDirectory, 'venv', 'Scripts', 'python.exe')
    : join(context.runtimeDirectory, 'venv', 'bin', 'python')

  return {
    inputPath,
    outputDirectory,
    pythonExecutable,
    modelsDirectory: join(context.runtimeDirectory, 'models'),
    separationDevice: context.platform === 'darwin' ? 'mps' : 'cpu',
    title: defaultTitle,
  }
}

function getDefaultRuntimeDirectory(platform: NodeJS.Platform): string {
  if (platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'Piano Accompaniment', 'audio-score')
  }

  return join(homedir(), '.local', 'share', 'piano-accompaniment', 'audio-score')
}
