import { jsPDF } from 'jspdf'
import type { ScoreVersion } from '../arrangement/types'
import { paginateScoreSystems, wrapScoreText } from './scorePdfLayout'
import { PDF_RENDER_WIDTH, renderPdfSystems } from './scorePdfRender'

type ExportScoreAsPdfInput = { scoreTitle: string; tempo: number; version: ScoreVersion }
const MARGIN = 40
const RASTER_SCALE = 3

export async function exportScoreAsPdf(input: ExportScoreAsPdfInput): Promise<void> {
  const systems = await renderPdfSystems(input.version)
  if (!systems.length) throw new Error('There are no measures to export.')
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
  pdf.setProperties({ title: input.scoreTitle, creator: 'Piano Accompaniment Studio' })
  const width = pdf.internal.pageSize.getWidth() - MARGIN * 2
  const height = pdf.internal.pageSize.getHeight() - MARGIN * 2 - 20
  const scale = width / PDF_RENDER_WIDTH
  const heading = renderHeading(input.scoreTitle, input.tempo)
  const heights = systems.map(system => system.height * scale)
  const headingHeight = heading.height / RASTER_SCALE * scale
  const pages = paginateScoreSystems(heights, height, headingHeight + 18, 22)
  for (const [pageIndex, placements] of pages.entries()) {
    if (pageIndex) pdf.addPage()
    else pdf.addImage(heading, 'PNG', MARGIN, MARGIN, width, headingHeight)
    for (const placement of placements) {
      const system = systems[placement.index]!
      const canvas = await rasterizeSvg(system.svg, system.height)
      pdf.addImage(canvas, 'PNG', MARGIN, MARGIN + placement.y, width, heights[placement.index]!)
      canvas.width = canvas.height = 0
    }
    pdf.setFontSize(9)
    pdf.setTextColor(100)
    pdf.text(`${pageIndex + 1} / ${pages.length}`, pdf.internal.pageSize.getWidth() / 2,
      pdf.internal.pageSize.getHeight() - 24, { align: 'center' })
  }
  pdf.save(`${input.scoreTitle.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')} - Piano accompaniment.pdf`)
}

function renderHeading(title: string, tempo: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')!
  context.font = '40px "Iowan Old Style", "Noto Serif TC", serif'
  const lines = wrapScoreText(title, PDF_RENDER_WIDTH - 32, text => context.measureText(text).width)
  const height = Math.max(1, lines.length) * 50 + 45
  canvas.width = PDF_RENDER_WIDTH * RASTER_SCALE
  canvas.height = height * RASTER_SCALE
  context.scale(RASTER_SCALE, RASTER_SCALE)
  context.fillStyle = '#fff'
  context.fillRect(0, 0, PDF_RENDER_WIDTH, height)
  context.fillStyle = '#111'
  context.font = '40px "Iowan Old Style", "Noto Serif TC", serif'
  context.textAlign = 'center'
  lines.forEach((line, index) => context.fillText(line, PDF_RENDER_WIDTH / 2, 40 + index * 50))
  context.font = '20px serif'
  context.textAlign = 'left'
  context.fillText(`♩ = ${tempo}`, 16, height - 8)
  // The PDF consumes physical dimensions, not raster pixel dimensions.
  return canvas
}

async function rasterizeSvg(svg: string, height: number): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = PDF_RENDER_WIDTH * RASTER_SCALE
    canvas.height = Math.ceil(height * RASTER_SCALE)
    const context = canvas.getContext('2d')!
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas
  } finally {
    URL.revokeObjectURL(url)
  }
}
