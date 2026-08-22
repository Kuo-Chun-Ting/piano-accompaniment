import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, expect, test } from 'vitest'

const temporaryDirectories: string[] = []

afterEach(() => {
  temporaryDirectories.splice(0).forEach(directory => rmSync(directory, {
    recursive: true,
    force: true,
  }))
})

test('test_export_notes_when_midi_contains_sustain_control_changes_then_preserves_pedal_events', () => {
  // Arrange
  const directory = createTemporaryDirectory()
  const inputPath = join(directory, 'performance.mid')
  const outputPath = join(directory, 'notes.json')
  writeFileSync(join(directory, 'mido.py'), MIDO_STUB, 'utf8')
  writeFileSync(inputPath, JSON.stringify({
    length: 1,
    ticksPerBeat: 480,
    messages: [
      { type: 'note_on', time: 0.1, channel: 0, note: 60, velocity: 90 },
      { type: 'control_change', time: 0.2, channel: 0, control: 64, value: 127 },
      { type: 'note_off', time: 0.3, channel: 0, note: 60, velocity: 0 },
      { type: 'control_change', time: 0.4, channel: 0, control: 64, value: 0 },
    ],
  }), 'utf8')

  // Act
  execFileSync('python3', [
    resolve('scripts/audio-score/export-midi-notes.py'),
    '--input',
    inputPath,
    '--output',
    outputPath,
  ], {
    env: { ...process.env, PYTHONPATH: directory },
  })
  const result = JSON.parse(readFileSync(outputPath, 'utf8'))

  // Assert
  expect(result.pedalEvents).toEqual([
    { timeSeconds: 0.3, value: 127 },
    { timeSeconds: 1, value: 0 },
  ])
})

function createTemporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'export-midi-notes-'))
  temporaryDirectories.push(directory)
  return directory
}

const MIDO_STUB = `
import json
from pathlib import Path

class Message:
    def __init__(self, values):
        for key, value in values.items():
            setattr(self, key, value)

class MidiFile:
    def __init__(self, path):
        data = json.loads(Path(path).read_text())
        self.length = data["length"]
        self.ticks_per_beat = data["ticksPerBeat"]
        self.messages = [Message(values) for values in data["messages"]]

    def __iter__(self):
        return iter(self.messages)
`
