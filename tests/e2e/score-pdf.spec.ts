import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { buildAudioScoreFixture } from '../fixtures/audioScore'
import { buildScoreSystems } from '../../shared/ui/scoreSystems'

test('test_scorePdf_when_downloaded_then_exports_all_measures_without_changing_screen_layout', async ({ page }, testInfo) => {
  // Arrange
  const result = buildAudioScoreFixture()
  result.title = '安靜 / PDF test'
  result.version.measures[0]!.lyrics = [{ startBeat: 1, text: '很長的中文歌詞與 English lyrics that must stay inside the printed measure without clipping at the right margin.' }]
  await page.addInitScript(() => {
    sessionStorage.setItem('audio-score-job', 'pdf')
    const original = URL.createObjectURL.bind(URL)
    const exports: Promise<string>[] = []
    Object.assign(window, { exportedSystems: exports })
    URL.createObjectURL = blob => {
      if (blob instanceof Blob && blob.type.startsWith('image/svg+xml')) exports.push(blob.text())
      return original(blob)
    }
  })
  await page.route('**/api/audio-scores/pdf', route => route.fulfill({ json: {
    id: 'pdf', title: result.title, status: 'succeeded', stage: 'build-viewer', result,
  } }))
  await page.goto('/')
  await expect(page.locator('.score-system[data-layout-ready=true]')).toHaveCount(3)
  const screen = await page.locator('.score-sheet').boundingBox()
  // Act
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export score as PDF' }).click()
  const download = await downloading
  const output = testInfo.outputPath('score.pdf')
  await download.saveAs(output)
  // Assert
  expect(download.suggestedFilename()).toBe('安靜 _ PDF test - Piano accompaniment.pdf')
  const bytes = await readFile(output)
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-')
  expect(bytes.length).toBeGreaterThan(10000)
  const systems = await page.evaluate(() => Promise.all((window as unknown as { exportedSystems: Promise<string>[] }).exportedSystems))
  expect(systems).toHaveLength(buildScoreSystems(result.version.measures, 3).length)
  systems.forEach(svg => expect(svg).toContain('data:font/woff2'))
  await expect(page.getByRole('button', { name: 'Export score as PDF' })).toBeEnabled()
  expect(await page.locator('.score-sheet').boundingBox()).toEqual(screen)
  expect(await page.locator('[style*="-20000px"]').count()).toBe(0)
})
