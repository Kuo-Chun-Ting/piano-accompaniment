import { describe, expect, test } from 'vitest'
import {
  buildAudioScorePipeline,
  resolveAudioScorePaths,
} from '../../../shared/audio-transcription/pipeline'

describe('audioScorePipeline', () => {
  test('test_resolveAudioScorePaths_when_output_has_spaces_then_returns_deterministic_layout', () => {
    // Arrange
    const outputDirectory = '/tmp/My Score Output'

    // Act
    const paths = resolveAudioScorePaths(outputDirectory)

    // Assert
    expect(paths).toEqual({
      outputDirectory,
      workDirectory: '/tmp/My Score Output/work',
      normalizedInputDirectory: '/tmp/My Score Output/work/input',
      normalizedAudio: '/tmp/My Score Output/work/input/normalized.wav',
      stemsDirectory: '/tmp/My Score Output/work/stems',
      pianoStem: '/tmp/My Score Output/work/stems/normalized_piano.wav',
      vocalsStem: '/tmp/My Score Output/work/stems/normalized_vocals.wav',
      midi: '/tmp/My Score Output/piano.mid',
      structureDirectory: '/tmp/My Score Output/work/structure',
      structure: '/tmp/My Score Output/work/structure/normalized.json',
      demixDirectory: '/tmp/My Score Output/work/allinone-demix',
      spectrogramDirectory: '/tmp/My Score Output/work/allinone-spec',
      notes: '/tmp/My Score Output/work/notes.json',
      lyrics: '/tmp/My Score Output/work/lyrics.json',
      pianoAudio: '/tmp/My Score Output/piano.wav',
      score: '/tmp/My Score Output/score.json',
      report: '/tmp/My Score Output/report.json',
      viewer: '/tmp/My Score Output/index.html',
    })
  })

  test('test_buildAudioScorePipeline_when_paths_have_spaces_then_preserves_argument_boundaries', () => {
    // Arrange
    const inputPath = '/music/Sonance Recording.wav'

    // Act
    const commands = buildAudioScorePipeline({
      inputPath,
      outputDirectory: '/tmp/My Score Output',
      pythonExecutable: '/tmp/audio venv/bin/python',
      modelsDirectory: '/tmp/model weights',
      projectDirectory: '/project root',
      caFile: '/tmp/audio venv/certifi.pem',
      separationDevice: 'mps',
    })

    // Assert
    expect(commands.map(command => command.stage)).toEqual([
      'normalize-audio',
      'separate-piano',
      'transcribe-midi',
      'analyze-structure',
      'export-midi-notes',
      'transcribe-lyrics',
    ])
    expect(commands[0]).toMatchObject({
      executable: 'ffmpeg',
      args: expect.arrayContaining([inputPath, '/tmp/My Score Output/work/input/normalized.wav']),
    })
    expect(commands[1]).toMatchObject({
      executable: '/tmp/audio venv/bin/bs-roformer-infer',
      args: expect.arrayContaining(['--models_dir', '/tmp/model weights', '--device', 'mps']),
    })
    expect(commands[2]).toMatchObject({
      executable: '/tmp/audio venv/bin/transkun',
      args: [
        '/tmp/My Score Output/work/stems/normalized_piano.wav',
        '/tmp/My Score Output/piano.mid',
        '--device',
        'cpu',
      ],
    })
    expect(commands[3]?.environment).toEqual({
      SSL_CERT_FILE: '/tmp/audio venv/certifi.pem',
      HF_HOME: '/tmp/model weights/huggingface',
      HF_HUB_CACHE: '/tmp/model weights/huggingface/hub',
      TORCH_HOME: '/tmp/model weights/torch',
    })
    expect(commands[4]).toMatchObject({
      executable: '/tmp/audio venv/bin/python',
      args: [
        '/project root/scripts/audio-score/export-midi-notes.py',
        '--input',
        '/tmp/My Score Output/piano.mid',
        '--output',
        '/tmp/My Score Output/work/notes.json',
      ],
    })
    expect(commands[5]).toMatchObject({
      executable: '/tmp/audio venv/bin/python',
      args: [
        '/project root/scripts/audio-score/transcribe-lyrics.py',
        '--input',
        '/tmp/My Score Output/work/stems/normalized_vocals.wav',
        '--output',
        '/tmp/My Score Output/work/lyrics.json',
        '--model',
        'turbo',
        '--model-cache',
        '/tmp/model weights/whisper',
      ],
    })
  })
})
