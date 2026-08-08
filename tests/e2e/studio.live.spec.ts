import { expect, test, type Page } from '@playwright/test'

const LIVE_CHART_PATH = 'chord-charts/楓.jpeg'
const MIN_EXPECTED_MEASURES = 40

async function openStudio(page: Page): Promise<void> {
  await page.goto('/')
  await page.waitForFunction(() => '__vue_app__' in (document.querySelector('#__nuxt') ?? {}))
}

test.describe.configure({ retries: 0 })

test('test_studio_when_live_api_reads_feng_chart_then_renders_chart_and_score @live', async ({ page }) => {
  test.setTimeout(360_000)

  // Arrange
  let parseChartRequestCount = 0
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/parse-chart') {
      parseChartRequestCount += 1
    }
  })
  await openStudio(page)
  await page.setInputFiles('input[type="file"]', LIVE_CHART_PATH)
  await page.getByLabel('Analysis model').selectOption('gpt-5.5')

  // Act
  await page.getByRole('button', { name: 'Analyze' }).click()

  // Assert
  await expect(page.getByRole('heading', { name: '楓' })).toBeVisible({ timeout: 330_000 })
  const chordInputs = page.getByRole('textbox', { name: 'Chord', exact: true })
  const chords = await chordInputs.evaluateAll(elements =>
    elements.map(element => (element as HTMLInputElement).value),
  )
  expect(chords.length).toBeGreaterThanOrEqual(MIN_EXPECTED_MEASURES)
  expect(chords.slice(0, 6)).toEqual(['Am', 'Em7', 'F', 'C', 'G/B', 'Am'])
  await expect(page.getByRole('button', { name: 'Create Piano Score' })).toBeEnabled()
  expect(parseChartRequestCount).toBe(1)

  // Act
  await page.getByRole('button', { name: 'Create Piano Score' }).click()

  // Assert
  await expect(page.locator('.score-workspace svg').first()).toBeVisible()
})
