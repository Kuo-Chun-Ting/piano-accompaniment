import { describe, expect, test } from 'vitest'
import type { ChartWorkspaceSnapshot } from '../../../shared/workspace/persistence'
import {
  parseChartWorkspaceSnapshot,
  persistChartWorkspaceSnapshot,
  serializeChartWorkspaceSnapshot,
} from '../../../shared/workspace/persistence'

describe('chart workspace persistence', () => {
  test('test_parseChartWorkspaceSnapshot_when_serialized_snapshot_then_returns_workspace_state', () => {
    // Arrange
    const snapshot = buildWorkspaceSnapshot()
    const serializedSnapshot = JSON.stringify(snapshot)

    // Act
    const result = parseChartWorkspaceSnapshot(serializedSnapshot)

    // Assert
    expect(result).toEqual(snapshot)
  })

  test('test_parseChartWorkspaceSnapshot_when_raw_value_is_invalid_then_returns_null', () => {
    // Arrange
    const serializedSnapshot = '{not-json'

    // Act
    const result = parseChartWorkspaceSnapshot(serializedSnapshot)

    // Assert
    expect(result).toBeNull()
  })

  test('test_parseChartWorkspaceSnapshot_when_json_shape_is_invalid_then_returns_null', () => {
    // Arrange
    const serializedSnapshot = JSON.stringify({
      uploadedImages: [{
        filename: '浪流連.jpeg',
        order: 'first',
        dataUrl: 'data:image/jpeg;base64,abc',
      }],
      extractedChart: null,
      confirmedChart: null,
    })

    // Act
    const result = parseChartWorkspaceSnapshot(serializedSnapshot)

    // Assert
    expect(result).toBeNull()
  })

  test('test_persistChartWorkspaceSnapshot_when_workspace_has_content_then_saves_snapshot', () => {
    // Arrange
    const snapshot = buildWorkspaceSnapshot()
    const stubStorage = createStubStorage()

    // Act
    persistChartWorkspaceSnapshot(stubStorage, 'workspace', snapshot)

    // Assert
    expect(stubStorage.getItem('workspace')).toBe(serializeChartWorkspaceSnapshot(snapshot))
  })

  test('test_persistChartWorkspaceSnapshot_when_workspace_is_empty_then_removes_snapshot', () => {
    // Arrange
    const snapshot: ChartWorkspaceSnapshot = {
      uploadedImages: [],
      extractedChart: null,
      confirmedChart: null,
    }
    const stubStorage = createStubStorage({ workspace: 'stale snapshot' })

    // Act
    persistChartWorkspaceSnapshot(stubStorage, 'workspace', snapshot)

    // Assert
    expect(stubStorage.getItem('workspace')).toBeNull()
  })
})

function createStubStorage(initialValues: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initialValues))

  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => Array.from(values.keys())[index] ?? null,
    removeItem: key => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  }
}

function buildWorkspaceSnapshot(): ChartWorkspaceSnapshot {
  return {
    uploadedImages: [{
      filename: '浪流連.jpeg',
      order: 0,
      dataUrl: 'data:image/jpeg;base64,abc',
    }],
    extractedChart: {
      title: { value: '浪流連', confidence: 'visible' },
      originalKey: { value: 'C', confidence: 'visible' },
      mode: { value: 'major', confidence: 'visible' },
      meter: { value: '4/4', confidence: 'visible' },
      tempo: { value: 63, confidence: 'visible' },
      moodRecommendation: {
        mood: 'flowing-narrative',
        confidence: 'visible',
        rationale: 'Visible tempo and chord rhythm indicate a medium ballad.',
      },
      sections: [{
        id: 'verse',
        label: 'Verse',
        order: 1,
        confidence: 'visible',
        measures: [{
          index: 1,
          boundaryConfidence: 'visible',
          lyric: { value: '這個風風雨雨的社會', confidence: 'visible' },
          chords: [{
            chord: { value: 'Fmaj7', confidence: 'visible' },
            durationBeats: { value: 2, confidence: 'visible' },
            lyric: { value: '這個風風雨雨的社會', confidence: 'visible' },
          }, {
            chord: { value: 'G', confidence: 'visible' },
            durationBeats: { value: 2, confidence: 'visible' },
            lyric: { value: null, confidence: 'missing' },
          }],
        }],
      }],
      annotations: [],
      warnings: [],
    },
    confirmedChart: {
      title: '浪流連',
      originalKey: 'C',
      mode: 'major',
      normalizedKey: 'C',
      meter: '4/4',
      tempo: 63,
      mood: 'flowing-narrative',
      sections: [{
        id: 'verse',
        label: 'Verse',
        order: 1,
        measures: [{
          index: 1,
          lyric: '這個風風雨雨的社會',
          sourceLyricConfidence: 'visible',
          chords: [{
            chord: 'Fmaj7',
            durationBeats: 2,
            lyric: '這個風風雨雨的社會',
            sourceChordConfidence: 'visible',
            sourceDurationConfidence: 'visible',
            sourceLyricConfidence: 'visible',
            wasEdited: false,
          }, {
            chord: 'G',
            durationBeats: 2,
            lyric: null,
            sourceChordConfidence: 'visible',
            sourceDurationConfidence: 'visible',
            sourceLyricConfidence: 'missing',
            wasEdited: false,
          }],
        }],
      }],
    },
  }
}
