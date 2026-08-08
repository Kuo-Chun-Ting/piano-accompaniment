import { describe, expect, test } from 'vitest'
import {
  commitEditorHistory,
  createEditorHistory,
  redoEditorHistory,
  undoEditorHistory,
} from '../../../shared/chart-editor/history'

describe('chart editor history', () => {
  test('test_undoEditorHistory_when_text_was_committed_per_character_then_removes_one_character', () => {
    // Arrange
    let history = createEditorHistory({ lyric: '' })
    history = commitEditorHistory(history, { lyric: '烏' })
    history = commitEditorHistory(history, { lyric: '烏雲' })

    // Act
    history = undoEditorHistory(history)

    // Assert
    expect(history.present.lyric).toBe('烏')
  })

  test('test_redoEditorHistory_when_change_was_undone_then_restores_change', () => {
    // Arrange
    let history = createEditorHistory({ chord: 'C' })
    history = commitEditorHistory(history, { chord: 'G' })
    history = undoEditorHistory(history)

    // Act
    history = redoEditorHistory(history)

    // Assert
    expect(history.present.chord).toBe('G')
  })

  test('test_commitEditorHistory_when_called_after_undo_then_clears_redo_branch', () => {
    // Arrange
    let history = createEditorHistory({ chord: 'C' })
    history = commitEditorHistory(history, { chord: 'G' })
    history = undoEditorHistory(history)

    // Act
    history = commitEditorHistory(history, { chord: 'Am' })

    // Assert
    expect(history.present.chord).toBe('Am')
    expect(history.future).toEqual([])
  })

  test('test_undoEditorHistory_when_no_past_exists_then_returns_same_history', () => {
    // Arrange
    const history = createEditorHistory({ chord: 'C' })

    // Act
    const result = undoEditorHistory(history)

    // Assert
    expect(result).toBe(history)
  })

  test('test_redoEditorHistory_when_no_future_exists_then_returns_same_history', () => {
    // Arrange
    const history = createEditorHistory({ chord: 'C' })

    // Act
    const result = redoEditorHistory(history)

    // Assert
    expect(result).toBe(history)
  })
})
