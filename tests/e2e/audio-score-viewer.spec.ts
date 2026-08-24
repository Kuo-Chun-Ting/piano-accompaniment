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
  await expect.poll(async () => page.locator('.score-system').evaluateAll(systems =>
    systems.every(system => (system as HTMLElement).dataset.layoutReady === 'true')))
    .toBe(true)
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
      oversizedStems: stemBoxes.filter(box => box.height > 120).length,
      maxStemHeight: Math.max(0, ...stemBoxes.map(box => box.height)),
    }
  }))
  expect(notationGeometry).toEqual(notationGeometry.map(system => ({
    ...system,
    verticalOverflow: 0,
    oversizedStems: 0,
  })))

  const contentLayers = await page.locator('.score-system svg').evaluateAll(svgs => svgs.map((svg) => {
    const getBox = (selector: string) => {
      const elements = [...svg.querySelectorAll<SVGGraphicsElement>(selector)]
      if (elements.length === 0) {
        return null
      }
      const boxes = elements.map(element => element.getBBox())
      const top = Math.min(...boxes.map(box => box.y))
      const bottom = Math.max(...boxes.map(box => box.y + box.height))
      return { top, bottom }
    }
    const notation = getBox('.vf-score-notation')
    const pedal = getBox('.vf-pedal-marking')
    const lyrics = getBox('.vf-score-lyrics')

    return {
      pedalGap: notation && pedal ? pedal.top - notation.bottom : null,
      lyricGap: lyrics ? lyrics.top - (pedal?.bottom ?? notation?.bottom ?? lyrics.top) : null,
    }
  }))
  expect(contentLayers.some(system => system.pedalGap !== null)).toBe(true)
  expect(contentLayers.some(system => system.lyricGap !== null)).toBe(true)
  for (const system of contentLayers) {
    if (system.pedalGap !== null) {
      expect(system.pedalGap).toBeGreaterThanOrEqual(8)
    }
    if (system.lyricGap !== null) {
      expect(system.lyricGap).toBeGreaterThanOrEqual(8)
    }
  }
  await expect(page.getByLabel('Arrangement versions')).toHaveCount(0)
  await expect(page.getByLabel('Export score as PDF')).toBeVisible()
  const sourceMenu = page.getByLabel('Playback source', { exact: true })
  await expect(sourceMenu).toBeVisible()
  await expect(sourceMenu).toContainText('Score')
  await expect(page.getByRole('button', { name: 'Play' })).toHaveCount(1)

  const playerGeometry = await page.locator('.player-controls').evaluate((player) => {
    const playerBox = player.getBoundingClientRect()
    const progressBox = player.querySelector('[aria-label="Playback progress"]')!.getBoundingClientRect()
    const sourceBox = player.querySelector('[aria-label="Playback source"]')!.getBoundingClientRect()
    return {
      centerDifference: Math.abs(
        sourceBox.left + sourceBox.width / 2 - (playerBox.left + playerBox.width / 2),
      ),
      sourceBelowProgress: sourceBox.top >= progressBox.bottom,
      hasTransport: Boolean(player.querySelector('.transport')),
    }
  })
  expect(playerGeometry).toEqual({
    centerDifference: expect.any(Number),
    sourceBelowProgress: true,
    hasTransport: true,
  })
  expect(playerGeometry.centerDifference).toBeLessThanOrEqual(2)

  const tempo = page.getByLabel('Playback BPM')
  await tempo.fill('96')
  await tempo.press('Enter')
  await expect(tempo).toHaveValue('96')

  const play = page.getByRole('button', { name: 'Play' })
  await play.click()
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()

  const progress = page.getByLabel('Playback progress')
  await expect.poll(async () => Number(await progress.inputValue()))
    .toBeGreaterThan(0)

  await page.locator('.system-row').nth(1).click({ position: { x: 300, y: 120 } })
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
  await page.getByRole('button', { name: 'Stop' }).click()
  await expect(progress).toHaveValue('0')

  await sourceMenu.click()
  await page.getByRole('menuitemradio', { name: 'Original Piano' }).click()
  await expect(sourceMenu).toContainText('Original Piano')

  const firstSystem = page.locator('.system-row').first()
  const firstSystemBounds = await firstSystem.boundingBox()
  expect(firstSystemBounds).not.toBeNull()
  await firstSystem.click({
    position: {
      x: firstSystemBounds!.width * 0.125,
      y: 120,
    },
  })
  if (!suppliedViewerPath) {
    const clickedReferenceSeconds = await page.evaluate(() =>
      (Reflect.get(globalThis, '__referenceAudio') as { currentTime: number }).currentTime)
    expect(clickedReferenceSeconds).toBeGreaterThanOrEqual(9.7)
    expect(clickedReferenceSeconds).toBeLessThan(9.9)
  }
  await page.getByRole('button', { name: 'Stop' }).click()

  await play.click()
  await expect.poll(async () => Number(await progress.inputValue()))
    .toBeGreaterThan(0)

  await progress.fill('0.5')
  await progress.dispatchEvent('change')
  const referenceState = await page.evaluate(() => {
    const audio = Reflect.get(globalThis, '__referenceAudio') as {
      currentTime: number
      playbackRate: number
      preservesPitch: boolean
    }
    return {
      currentTime: audio.currentTime,
      playbackRate: audio.playbackRate,
      preservesPitch: audio.preservesPitch,
    }
  })
  if (suppliedViewerPath) {
    expect(referenceState.currentTime).toBeGreaterThan(0)
    expect(referenceState.playbackRate).toBeGreaterThan(0)
  } else {
    expect(referenceState.currentTime).toBeGreaterThanOrEqual(13.78)
    expect(referenceState.currentTime).toBeLessThan(13.9)
    expect(referenceState.playbackRate).toBe(0.8)
  }
  expect(referenceState.preservesPitch).toBe(true)

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

    class AudioMock {
      playbackRate = 1
      preservesPitch = false
      preload = ''
      private offsetSeconds = 0
      private startedAt = 0
      private playing = false

      constructor(public src: string) {
        Object.defineProperty(globalThis, '__referenceAudio', { value: this, configurable: true })
      }

      get currentTime(): number {
        if (!this.playing) {
          return this.offsetSeconds
        }
        return this.offsetSeconds + (performance.now() - this.startedAt) / 1000 * this.playbackRate
      }

      set currentTime(value: number) {
        this.offsetSeconds = value
        this.startedAt = performance.now()
      }

      async play(): Promise<void> {
        this.startedAt = performance.now()
        this.playing = true
      }

      pause(): void {
        this.offsetSeconds = this.currentTime
        this.playing = false
      }

      addEventListener(): void {}
      removeEventListener(): void {}
    }

    Object.defineProperty(globalThis, 'AudioContext', { value: AudioContextMock })
    Object.defineProperty(globalThis, 'Audio', { value: AudioMock })
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
    buildEvent(1, 2, [{ pitch: 'C4', tieToNext: true }]),
    buildEvent(3, 2, [{ pitch: 'C4', tieFromPrevious: true }]),
  ])
  const quarterMeasures = Array.from({ length: 3 }, (_, index) => {
    const melody = Array.from({ length: 4 }, (__, eventIndex) =>
      buildEvent(eventIndex + 1, 1, ['E4']))
    return buildMeasure(
      index + 3,
      melody,
      index === 0 ? [melody, [buildEvent(1, 4, ['G5'])]] : [melody],
    )
  })

  return {
    title: expectedTitle,
    tempo: 120,
    version: {
      level: 'rich' as const,
      measures: [beamedMeasure, tiedMeasure, ...quarterMeasures],
      pedalIntervals: [{ startBeatOffset: 0.5, endBeatOffset: 3 }],
    },
    referenceAudio: {
      src: 'piano.wav',
      scoreStartSeconds: 8.79,
      sourceBpm: 120,
      beatSeconds: Array.from({ length: 21 }, (_, index) => 8.79 + index * 0.5),
    },
  }
}

function buildMeasure(
  index: number,
  trebleEvents: ScoreEvent[],
  trebleVoices: ScoreEvent[][] = [trebleEvents],
) {
  return {
    sectionId: 'fixture',
    sectionLabel: 'Fixture',
    index,
    chordSymbols: [],
    lyrics: index === 1
      ? [{ startBeat: 1, text: '只剩下鋼琴陪我彈了一天' }]
      : [],
    intensity: 'medium' as const,
    staves: [
      {
        id: 'treble' as const,
        clef: 'treble' as const,
        voices: trebleVoices.map((events, voiceIndex) => ({
          id: `treble-${voiceIndex + 1}`,
          events,
        })),
      },
      {
        id: 'bass' as const,
        clef: 'bass' as const,
        voices: [{ id: 'bass-1', events: [buildEvent(1, 4, [])] }],
      },
    ],
  }
}

function buildEvent(
  startBeat: number,
  durationBeats: number,
  pitches: string[] | ScoreEvent['notes'],
): ScoreEvent {
  return {
    startBeat,
    durationBeats,
    notes: typeof pitches[0] === 'string'
      ? (pitches as string[]).map(pitch => ({ pitch }))
      : pitches as ScoreEvent['notes'],
  }
}

function resolveViewerTitle(path: string): string {
  return basename(path) === 'index.html'
    ? basename(dirname(path))
    : basename(path).replace(/-score\.html$/, '')
}
