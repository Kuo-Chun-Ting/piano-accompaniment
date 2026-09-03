import { dirname, join } from 'node:path'

export type AudioScorePaths = {
  outputDirectory: string
  workDirectory: string
  normalizedInputDirectory: string
  normalizedAudio: string
  stemsDirectory: string
  pianoStem: string
  vocalsStem: string
  midi: string
  structureDirectory: string
  structure: string
  demixDirectory: string
  spectrogramDirectory: string
  notes: string
  pitchEnergy: string
  cleanedNotes: string
  lyrics: string
  pianoAudio: string
  score: string
  report: string
  viewer: string
}

export type PipelineCommand = {
  stage: string
  executable: string
  args: string[]
  environment?: Record<string, string>
}

export type AudioScorePipelineConfig = {
  inputPath: string
  outputDirectory: string
  pythonExecutable: string
  modelsDirectory: string
  projectDirectory: string
  caFile: string
  separationDevice: 'cpu' | 'mps'
  ffmpegExecutable?: string
}

export function resolveAudioScorePaths(outputDirectory: string): AudioScorePaths {
  const workDirectory = join(outputDirectory, 'work')
  const normalizedInputDirectory = join(workDirectory, 'input')
  const stemsDirectory = join(workDirectory, 'stems')
  const structureDirectory = join(workDirectory, 'structure')

  return {
    outputDirectory,
    workDirectory,
    normalizedInputDirectory,
    normalizedAudio: join(normalizedInputDirectory, 'normalized.wav'),
    stemsDirectory,
    pianoStem: join(stemsDirectory, 'normalized_piano.wav'),
    vocalsStem: join(stemsDirectory, 'normalized_vocals.wav'),
    midi: join(outputDirectory, 'piano.mid'),
    structureDirectory,
    structure: join(structureDirectory, 'normalized.json'),
    demixDirectory: join(workDirectory, 'allinone-demix'),
    spectrogramDirectory: join(workDirectory, 'allinone-spec'),
    notes: join(workDirectory, 'notes.json'),
    pitchEnergy: join(workDirectory, 'pitch-energy.json'),
    cleanedNotes: join(workDirectory, 'cleaned-notes.json'),
    lyrics: join(workDirectory, 'lyrics.json'),
    pianoAudio: join(outputDirectory, 'piano.wav'),
    score: join(outputDirectory, 'score.json'),
    report: join(outputDirectory, 'report.json'),
    viewer: join(outputDirectory, 'index.html'),
  }
}

export function buildAudioScorePipeline(config: AudioScorePipelineConfig): PipelineCommand[] {
  const paths = resolveAudioScorePaths(config.outputDirectory)
  const pythonBinDirectory = dirname(config.pythonExecutable)

  return [
    {
      stage: 'normalize-audio',
      executable: config.ffmpegExecutable ?? 'ffmpeg',
      args: [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-i',
        config.inputPath,
        '-vn',
        '-ac',
        '2',
        '-ar',
        '44100',
        '-c:a',
        'pcm_f32le',
        paths.normalizedAudio,
      ],
    },
    {
      stage: 'separate-piano',
      executable: join(pythonBinDirectory, 'bs-roformer-infer'),
      args: [
        '--models_dir',
        config.modelsDirectory,
        '--input_folder',
        paths.normalizedInputDirectory,
        '--store_dir',
        paths.stemsDirectory,
        '--device',
        config.separationDevice,
      ],
    },
    {
      stage: 'transcribe-midi',
      executable: join(pythonBinDirectory, 'transkun'),
      args: [
        paths.pianoStem,
        paths.midi,
        '--device',
        'cpu',
      ],
    },
    {
      stage: 'analyze-structure',
      executable: join(pythonBinDirectory, 'all-in-one-infer'),
      args: [
        paths.normalizedAudio,
        '--out-dir',
        paths.structureDirectory,
        '--demix-dir',
        paths.demixDirectory,
        '--spec-dir',
        paths.spectrogramDirectory,
        '--device',
        'cpu',
        '--no-multiprocess',
        '--overwrite',
      ],
      environment: {
        SSL_CERT_FILE: config.caFile,
        HF_HOME: join(config.modelsDirectory, 'huggingface'),
        HF_HUB_CACHE: join(config.modelsDirectory, 'huggingface', 'hub'),
        TORCH_HOME: join(config.modelsDirectory, 'torch'),
      },
    },
    {
      stage: 'export-midi-notes',
      executable: config.pythonExecutable,
      args: [
        join(config.projectDirectory, 'scripts/audio-score/export-midi-notes.py'),
        '--input',
        paths.midi,
        '--output',
        paths.notes,
      ],
    },
    {
      stage: 'export-pitch-energy',
      executable: config.pythonExecutable,
      args: [
        join(config.projectDirectory, 'scripts/audio-score/export-pitch-energy.py'),
        '--input',
        paths.pianoStem,
        '--output',
        paths.pitchEnergy,
        '--notes',
        paths.notes,
      ],
    },
    {
      stage: 'transcribe-lyrics',
      executable: config.pythonExecutable,
      args: [
        join(config.projectDirectory, 'scripts/audio-score/transcribe-lyrics.py'),
        '--input',
        paths.vocalsStem,
        '--output',
        paths.lyrics,
        '--model',
        'turbo',
        '--model-cache',
        join(config.modelsDirectory, 'whisper'),
      ],
      environment: {
        SSL_CERT_FILE: config.caFile,
        HF_HOME: join(config.modelsDirectory, 'huggingface'),
        HF_HUB_CACHE: join(config.modelsDirectory, 'huggingface', 'hub'),
      },
    },
  ]
}
