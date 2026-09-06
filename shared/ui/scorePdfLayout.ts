export type PdfSystemPlacement = { index: number; y: number }

export function paginateScoreSystems(
  heights: number[], availableHeight: number, headingHeight: number, gap: number,
): PdfSystemPlacement[][] {
  const pages: PdfSystemPlacement[][] = [[]]
  let y = headingHeight
  heights.forEach((height, index) => {
    if (!Number.isFinite(height) || height <= 0 || height > availableHeight) {
      throw new Error('Score system is too tall for an A4 page.')
    }
    if (y + height > availableHeight) {
      pages.push([])
      y = 0
    }
    pages[pages.length - 1]!.push({ index, y })
    y += height + gap
  })
  return pages
}

export function wrapScoreText(text: string, width: number, measure: (text: string) => number): string[] {
  const lines: string[] = []
  let line = ''
  for (const token of text.match(/\S+\s*|\s+/gu) ?? []) {
    if (line && measure(line + token.trimEnd()) > width) {
      lines.push(line.trimEnd())
      line = ''
    }
    for (const character of token) {
      if (line && measure(line + character) > width) {
        lines.push(line.trimEnd())
        line = ''
      }
      line += character
    }
  }
  if (line.trim()) lines.push(line.trimEnd())
  return lines
}
