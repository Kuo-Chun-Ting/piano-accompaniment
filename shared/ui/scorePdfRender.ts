import { createApp, h } from 'vue'
import bravura from '@vexflow-fonts/bravura/bravura.woff2?inline'
import academico from '@vexflow-fonts/academico/academico.woff2?inline'
import PianoScoreSystem from '../../components/PianoScoreSystem.vue'
import type { ScoreVersion } from '../arrangement/types'
import { buildScoreSystems, type ScoreSystem } from './scoreSystems'

export const PDF_RENDER_WIDTH = 1000
export type PdfSystemImage = { svg: string; height: number }

export async function renderPdfSystems(version: ScoreVersion): Promise<PdfSystemImage[]> {
  await document.fonts.ready
  const images: PdfSystemImage[] = []
  const pending = buildScoreSystems(version.measures, 3)
  for (const system of pending) {
    images.push(await renderSystem(system, version))
  }
  return images
}

async function renderSystem(system: ScoreSystem, version: ScoreVersion): Promise<PdfSystemImage> {
  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${PDF_RENDER_WIDTH}px;pointer-events:none`
  host.setAttribute('aria-hidden', 'true')
  document.body.append(host)
  const app = createApp({ render: () => h(PianoScoreSystem, {
    system, keySignature: version.keySignature, pedalIntervals: version.pedalIntervals, wrapLyrics: true,
  }) })
  try {
    app.mount(host)
    await waitForLayout(host)
    const svg = host.querySelector('svg')!
    const bounds = svg.getBBox()
    if (bounds.x < 0 || bounds.x + bounds.width > PDF_RENDER_WIDTH + 1) {
      throw new Error('Score is too wide to export without clipping.')
    }
    const top = bounds.y - 12
    const height = bounds.height + 24
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    svg.setAttribute('viewBox', `0 ${top} ${PDF_RENDER_WIDTH} ${height}`)
    svg.setAttribute('width', String(PDF_RENDER_WIDTH))
    svg.setAttribute('height', String(height))
    // SVG images cannot access the document's loaded web fonts.
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
    style.textContent = Object.entries({ Bravura: bravura, Academico: academico }).map(([name, url]) => {
      return `@font-face{font-family:"${name}";src:url("${url}")}`
    }).join('\n')
    svg.prepend(style)
    return { svg: new XMLSerializer().serializeToString(svg), height }
  } finally {
    app.unmount()
    host.remove()
  }
}

function waitForLayout(host: HTMLElement): Promise<void> {
  return new Promise((resolve, reject) => {
    const finish = (): void => {
      if (!host.querySelector('[data-layout-ready="true"]')) return
      clearTimeout(timer)
      observer.disconnect()
      resolve()
    }
    const observer = new MutationObserver(finish)
    const timer = setTimeout(() => {
      observer.disconnect()
      reject(new Error('Score layout timed out. Please try again.'))
    }, 15000)
    observer.observe(host, { attributes: true, subtree: true })
    finish()
  })
}
