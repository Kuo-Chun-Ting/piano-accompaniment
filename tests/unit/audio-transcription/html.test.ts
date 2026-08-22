import { expect, test } from 'vitest'
import { escapeHtmlText } from '../../../tools/audio-score-viewer/html'

test('test_escapeHtmlText_when_title_contains_markup_then_escapes_text_content', () => {
  // Act
  const result = escapeHtmlText('Piano & <Voice>')

  // Assert
  expect(result).toBe('Piano &amp; &lt;Voice&gt;')
})
