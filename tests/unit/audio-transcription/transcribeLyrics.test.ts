import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, expect, test } from 'vitest'

const temporaryDirectories: string[] = []

afterEach(() => {
  temporaryDirectories.splice(0).forEach(directory =>
    rmSync(directory, { recursive: true, force: true }))
})

test('test_transcribeLyrics_when_model_returns_segments_then_writes_timed_lyrics', () => {
  // Arrange
  const directory = createTemporaryDirectory()
  const stubDirectory = join(directory, 'stubs')
  const inputPath = join(directory, 'vocals.wav')
  const outputPath = join(directory, 'lyrics.json')
  const modelCache = join(directory, 'models')
  mkdirSync(stubDirectory)
  writeFileSync(inputPath, 'fixture')
  writeFileSync(join(stubDirectory, 'onnxruntime.py'), buildOnnxRuntimeStub())
  writeFileSync(join(stubDirectory, 'faster_whisper.py'), buildFasterWhisperStub())
  writeFileSync(join(stubDirectory, 'opencc.py'), buildOpenCcStub())

  // Act
  execFileSync('python3', [
    resolve('scripts/audio-score/transcribe-lyrics.py'),
    '--input', inputPath,
    '--output', outputPath,
    '--model', 'turbo',
    '--model-cache', modelCache,
  ], {
    env: { ...process.env, PYTHONPATH: stubDirectory },
  })

  // Assert
  expect(JSON.parse(readFileSync(outputPath, 'utf8'))).toEqual({
    language: 'zh',
    languageProbability: 0.98,
    segments: [{
      startSeconds: 8.25,
      endSeconds: 10.5,
      text: '只剩下鋼琴陪我談了一天',
    }],
  })
})

test('test_transcribeLyrics_when_starting_model_then_disables_onnx_telemetry_first', () => {
  // Arrange
  const directory = createTemporaryDirectory()
  const stubDirectory = join(directory, 'stubs')
  const inputPath = join(directory, 'vocals.wav')
  const outputPath = join(directory, 'lyrics.json')
  mkdirSync(stubDirectory)
  writeFileSync(inputPath, 'fixture')
  writeFileSync(join(stubDirectory, 'onnxruntime.py'), buildOnnxRuntimeStub())
  writeFileSync(
    join(stubDirectory, 'faster_whisper.py'),
    buildTelemetryAwareFasterWhisperStub(),
  )
  writeFileSync(join(stubDirectory, 'opencc.py'), buildOpenCcStub())

  // Act
  execFileSync('python3', [
    resolve('scripts/audio-score/transcribe-lyrics.py'),
    '--input', inputPath,
    '--output', outputPath,
    '--model', 'turbo',
    '--model-cache', join(directory, 'models'),
  ], {
    env: { ...process.env, PYTHONPATH: stubDirectory },
  })

  // Assert
  expect(JSON.parse(readFileSync(outputPath, 'utf8')).segments).toEqual([])
})

function createTemporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'transcribe-lyrics-test-'))
  temporaryDirectories.push(directory)
  return directory
}

function buildFasterWhisperStub(): string {
  return `
class Segment:
    def __init__(self, start, end, text, no_speech_prob):
        self.start = start
        self.end = end
        self.text = text
        self.no_speech_prob = no_speech_prob

class Info:
    language = "zh"
    language_probability = 0.98

class WhisperModel:
    def __init__(self, model, device, compute_type, download_root):
        assert model == "turbo"
        assert device == "cpu"
        assert compute_type == "int8"
        assert download_root.endswith("models")

    def transcribe(self, input_path, **options):
        assert input_path.endswith("vocals.wav")
        assert options == {
            "beam_size": 5,
            "condition_on_previous_text": False,
            "temperature": 0,
            "vad_filter": True,
            "vad_parameters": {"min_silence_duration_ms": 500},
            "word_timestamps": False,
        }
        return iter([
            Segment(8.25, 10.5, " 只剩下钢琴陪我谈了一天 ", 0.05),
            Segment(11.0, 12.0, "不該出現", 0.95),
        ]), Info()
`
}

function buildOnnxRuntimeStub(): string {
  return `
telemetry_disabled = False

def disable_telemetry_events():
    global telemetry_disabled
    telemetry_disabled = True
`
}

function buildTelemetryAwareFasterWhisperStub(): string {
  return `
import onnxruntime

class Info:
    language = "zh"
    language_probability = 0.98

class WhisperModel:
    def __init__(self, *args, **kwargs):
        assert onnxruntime.telemetry_disabled

    def transcribe(self, input_path, **options):
        return iter([]), Info()
`
}

function buildOpenCcStub(): string {
  return `
class OpenCC:
    def __init__(self, config):
        assert config == "s2t"

    def convert(self, text):
        return text.replace("钢", "鋼").replace("谈", "談")
`
}
