import { describe, expect, test, vi } from 'vitest'
import { exportScoreAsPdf } from '../../../shared/ui/scorePdf'

describe('score PDF export', () => {
  test('test_exportScoreAsPdf_when_called_then_prints_with_score_title_and_restores_page_title', () => {
    // Arrange
    const document = {
      title: 'Piano Accompaniment Studio',
    }
    const print = vi.fn(() => {
      expect(document.title).toBe('楓 - Piano accompaniment')
    })
    const listeners: { afterPrint: (() => void) | null } = { afterPrint: null }
    const addEventListener = vi.fn((_event: string, callback: () => void) => {
      listeners.afterPrint = callback
    })

    // Act
    exportScoreAsPdf({
      document,
      window: { print, addEventListener },
      scoreTitle: '楓',
    })

    // Assert
    expect(print).toHaveBeenCalledOnce()
    expect(addEventListener).toHaveBeenCalledWith('afterprint', expect.any(Function), { once: true })
    expect(document.title).toBe('楓 - Piano accompaniment')
    if (!listeners.afterPrint) {
      throw new Error('Expected afterprint listener')
    }
    listeners.afterPrint()
    expect(document.title).toBe('Piano Accompaniment Studio')
  })
})
