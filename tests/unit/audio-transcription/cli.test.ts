import { afterEach, describe, expect, test, vi } from 'vitest'
import { parseAudioScoreArgs } from '../../../shared/audio-transcription/cli'

afterEach(() => vi.unstubAllEnvs())

describe('audioScoreCli', () => {
  test('test_parseAudioScoreArgs_when_input_is_missing_then_throws_usage_error', () => {
    // Act
    const parse = () => parseAudioScoreArgs([], buildContext())

    // Assert
    expect(parse).toThrow('Usage: npm run audio:score')
  })

  test('test_parseAudioScoreArgs_when_input_is_not_wav_then_throws_format_error', () => {
    // Act
    const parse = () => parseAudioScoreArgs(['recording.mp4'], buildContext())

    // Assert
    expect(parse).toThrow('Input must be a WAV file')
  })

  test('test_parseAudioScoreArgs_when_recording_is_provided_then_derives_all_internal_paths', () => {
    // Act
    const result = parseAudioScoreArgs(['recordings/My Song.wav'], buildContext())

    // Assert
    expect(result).toEqual({
      inputPath: '/project/recordings/My Song.wav',
      outputDirectory: '/project/recordings/.audio-score/My Song',
      pythonExecutable: '/runtime/audio-score/venv/bin/python',
      modelsDirectory: '/runtime/audio-score/models',
      separationDevice: 'mps',
      title: 'My Song',
      buildViewer: true,
    })
  })

  test('test_parseAudioScoreArgs_when_skip_viewer_is_requested_then_disables_viewer_build', () => {
    // Arrange
    const args = ['recording.wav', '--skip-viewer']

    // Act
    const result = parseAudioScoreArgs(args, buildContext())

    // Assert
    expect(result.buildViewer).toBe(false)
  })

  test('test_parseAudioScoreArgs_when_runtime_environment_is_set_then_uses_that_directory', () => {
    // Arrange
    vi.stubEnv('AUDIO_SCORE_RUNTIME_DIR', '/container/runtime')

    // Act
    const result = parseAudioScoreArgs(['/tmp/recording.wav'])

    // Assert
    expect(result.modelsDirectory).toBe('/container/runtime/models')
    expect(result.pythonExecutable).toContain('/container/runtime/venv/')
  })

  test('test_parseAudioScoreArgs_when_device_is_omitted_on_mac_then_defaults_to_mps', () => {
    // Act
    const result = parseAudioScoreArgs(['recording.wav'], buildContext())

    // Assert
    expect(result.separationDevice).toBe('mps')
  })

  test('test_parseAudioScoreArgs_when_any_second_argument_is_present_then_rejects_it', () => {
    // Act
    const parse = () => parseAudioScoreArgs(['recording.wav', '--output'], buildContext())

    // Assert
    expect(parse).toThrow('Only one WAV recording path is accepted')
  })

  test('test_parseAudioScoreArgs_when_filename_has_no_usable_stem_then_rejects_it', () => {
    // Act
    const parse = () => parseAudioScoreArgs(['recordings/...wav'], buildContext())

    // Assert
    expect(parse).toThrow('WAV filename must contain a usable score name')
  })
})

function buildContext() {
  return {
    cwd: '/project',
    runtimeDirectory: '/runtime/audio-score',
    platform: 'darwin' as const,
  }
}
