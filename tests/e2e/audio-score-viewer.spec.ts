import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, test } from '@playwright/test'
import type { ScoreEvent } from '../../shared/arrangement/types'

const suppliedViewerPath = process.env.AUDIO_SCORE_VIEWER_PATH
let viewerPath = suppliedViewerPath ? resolve(suppliedViewerPath) : ''
let expectedTitle = suppliedViewerPath
  ? resolveViewerTitle(suppliedViewerPath)
  : 'Viewer Regression'
let temporaryDirectory: string | null = null

test.beforeAll(() => {
  if (viewerPath) {
    return
  }

  temporaryDirectory = mkdtempSync(join(tmpdir(), 'audio-score-viewer-e2e-'))
  const scorePath = join(temporaryDirectory, 'score.json')
  const outputDirectory = join(temporaryDirectory, 'viewer')
  writeFileSync(scorePath, `${JSON.stringify(buildViewerFixture(), null, 2)}\n`, 'utf8')
  execFileSync('npm', ['run', 'audio:score:viewer'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      AUDIO_SCORE_DATA: scorePath,
      AUDIO_SCORE_VIEWER_OUT: outputDirectory,
    },
    stdio: 'pipe',
  })
  viewerPath = join(outputDirectory, 'index.html')
})

test.afterAll(() => {
  if (temporaryDirectory) {
    rmSync(temporaryDirectory, { recursive: true, force: true })
  }
})

test('generated audio score renders and plays with existing controls', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await installAudioMock(page)

  await page.goto(pathToFileURL(viewerPath).href)

  await expect(page).toHaveTitle(expectedTitle)
  await expect(page.getByRole('heading', { name: expectedTitle })).toBeVisible()
  await expect(page.getByLabel('Piano score')).toBeVisible()
  await expect(page.locator('.score-system svg').first()).toBeVisible()
  await expect(page.locator('.vf-beam').first()).toBeVisible()
  await expect(page.locator('.vf-stavetie').first()).toBeVisible()
  if (!suppliedViewerPath) {
    await expect(page.locator('.vf-flag')).toHaveCount(0)
  }

  const notationGeometry = await page.locator('.score-system svg').evaluateAll(svgs => svgs.map((svg) => {
    const height = Number(svg.getAttribute('height'))
    const stems = [...svg.querySelectorAll<SVGGElement>('.vf-stem')]
    const stemBoxes = stems.map(stem => stem.getBBox())

    return {
      verticalOverflow: stemBoxes.filter(box => box.y < 0 || box.y + box.height > height).length,
    }
  }))
  expect(notationGeometry.every(system => system.verticalOverflow === 0)).toBe(true)
  await expect(page.getByLabel('Arrangement versions')).toHaveCount(0)
  await expect(page.getByLabel('Export score as PDF')).toBeVisible()

  const tempo = page.getByLabel('Playback BPM')
  await tempo.fill('96')
  await tempo.press('Enter')
  await expect(tempo).toHaveValue('96')

  const play = page.getByRole('button', { name: 'Play' })
  await play.click()
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()

  const progress = page.getByLabel('Score playback progress')
  await expect.poll(async () => Number(await progress.inputValue()))
    .toBeGreaterThan(0)

  await page.locator('.system-row').nth(1).click({ position: { x: 300, y: 120 } })
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
  await page.getByRole('button', { name: 'Stop' }).click()
  await expect(progress).toHaveValue('0')

  if (process.env.AUDIO_SCORE_SCREENSHOT_PATH) {
    await page.locator('[data-workspace-scroll]').evaluate(element => element.scrollTo(0, 0))
    await page.screenshot({
      path: resolve(process.env.AUDIO_SCORE_SCREENSHOT_PATH),
      fullPage: true,
    })
  }
  expect(pageErrors).toEqual([])
})

async function installAudioMock(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    class AudioContextMock {
      destination = {}
      get currentTime(): number { return Date.now() / 1000 }
      async resume(): Promise<void> {}
      async close(): Promise<void> {}
      async decodeAudioData(): Promise<object> { return {} }
      createBufferSource() {
        return {
          buffer: null,
          addEventListener() {},
          connect(target: object) { return target },
          start() {},
          stop() {},
        }
      }
      createGain() {
        return {
          gain: {
            setValueAtTime() {},
            linearRampToValueAtTime() {},
          },
          connect(target: object) { return target },
        }
      }
    }

    Object.defineProperty(globalThis, 'AudioContext', { value: AudioContextMock })
    Object.defineProperty(globalThis, 'fetch', {
      value: async () => ({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
      }),
    })
  })
}

function buildViewerFixture() {
  const beamedMeasure = buildMeasure(1, Array.from({ length: 8 }, (_, index) =>
    buildEvent(1 + index * 0.5, 0.5, [`${['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C'][index]}${index === 7 ? 5 : 4}`])))
  const tiedMeasure = buildMeasure(2, [
    { ...buildEvent(1, 2, ['C4']), tieToNext: true },
    { ...buildEvent(3, 2, ['C4']), tieFromPrevious: true },
  ])
  const quarterMeasures = Array.from({ length: 3 }, (_, index) =>
    buildMeasure(index + 3, Array.from({ length: 4 }, (__, eventIndex) =>
      buildEvent(eventIndex + 1, 1, ['E4']))))

  return {
    title: expectedTitle,
    tempo: 120,
    version: {
      level: 'rich' as const,
      measures: [beamedMeasure, tiedMeasure, ...quarterMeasures],
    },
  }
}

function buildMeasure(index: number, rightHand: ScoreEvent[]) {
  return {
    sectionId: 'fixture',
    sectionLabel: 'Fixture',
    index,
    chordSymbols: [],
    lyrics: [],
    intensity: 'medium' as const,
    rightHand,
    leftHand: [buildEvent(1, 4, [])],
  }
}

function buildEvent(startBeat: number, durationBeats: number, pitches: string[]): ScoreEvent {
  return {
    startBeat,
    durationBeats,
    pitches,
    fingers: [],
    tieToNext: false,
  }
}

function resolveViewerTitle(path: string): string {
  return basename(path) === 'index.html'
    ? basename(dirname(path))
    : basename(path).replace(/-score\.html$/, '')
}
