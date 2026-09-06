import { expect, test } from 'vitest'
import { paginateScoreSystems, wrapScoreText } from '../../../shared/ui/scorePdfLayout'

test('test_paginateScoreSystems_when_page_full_then_moves_whole_system_to_next_page', () => {
  // Arrange & Act
  const pages = paginateScoreSystems([200, 200, 200, 200], 700, 100, 20)
  // Assert
  expect(pages).toEqual([
    [{ index: 0, y: 100 }, { index: 1, y: 320 }],
    [{ index: 2, y: 0 }, { index: 3, y: 220 }],
  ])
})

test('test_paginateScoreSystems_when_system_exceeds_page_then_rejects_instead_of_clipping', () => {
  // Arrange & Act & Assert
  expect(() => paginateScoreSystems([701], 700, 100, 20)).toThrow('too tall')
})

test('test_paginateScoreSystems_when_system_fits_exactly_then_does_not_add_blank_page', () => {
  // Arrange & Act & Assert
  expect(paginateScoreSystems([280, 300], 700, 100, 20)).toHaveLength(1)
})

test('test_wrapScoreText_when_lyrics_exceed_width_then_preserves_words_and_wraps_chinese', () => {
  // Arrange
  const measure = (text: string) => text.length
  // Act & Assert
  expect(wrapScoreText('hello world', 6, measure)).toEqual(['hello', 'world'])
  expect(wrapScoreText('安靜的歌詞', 3, measure)).toEqual(['安靜的', '歌詞'])
})
