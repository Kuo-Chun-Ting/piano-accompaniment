import {
  expect,
  test,
  type Page,
  type Request,
  type Route,
} from '@playwright/test'
import { extractedChartFixture } from '../fixtures/extractedChart'

const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)
const QUOTA_ERROR_MESSAGE = 'OpenAI quota is unavailable. Check billing.'

type ParseChartRequest = {
  model: string
  images: Array<{
    filename: string
    dataUrl: string
    order: number
  }>
}

function buildResultStream(): string {
  const progress = {
    type: 'progress',
    event: {
      type: 'task-started',
      taskId: 'reading-chart',
      kind: 'reading-chart',
      title: 'Reading chart',
      attempt: 1,
      timestamp: 0,
    },
  }

  return [
    `data: ${JSON.stringify(progress)}`,
    `data: ${JSON.stringify({ type: 'result', chart: extractedChartFixture })}`,
    '',
  ].join('\n\n')
}

function buildErrorStream(message: string): string {
  return `data: ${JSON.stringify({ type: 'error', message })}\n\n`
}

async function openStudio(page: Page): Promise<void> {
  await page.goto('/')
  await page.waitForFunction(() => '__vue_app__' in (document.querySelector('#__nuxt') ?? {}))
}

async function uploadCharts(page: Page, filenames: string[]): Promise<void> {
  await page.setInputFiles(
    'input[type="file"]',
    filenames.map(name => ({
      name,
      mimeType: 'image/png',
      buffer: TRANSPARENT_PNG,
    })),
  )
}

function fulfillEventStream(route: Route, body: string): Promise<void> {
  return route.fulfill({
    status: 200,
    contentType: 'text/event-stream',
    body,
  })
}

function observeBrowserErrors(page: Page): {
  consoleErrors: string[]
  pageErrors: string[]
} {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []

  page.on('console', message => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })
  page.on('pageerror', error => pageErrors.push(error.message))

  return { consoleErrors, pageErrors }
}

function readParseChartRequest(request: Request): ParseChartRequest {
  return request.postDataJSON() as ParseChartRequest
}

test('test_studio_when_stubbed_chart_is_edited_then_sends_ordered_images_and_renders_score', async ({ page }) => {
  // Arrange
  const browserErrors = observeBrowserErrors(page)
  const requests: ParseChartRequest[] = []
  await page.route('**/api/parse-chart', async route => {
    requests.push(readParseChartRequest(route.request()))
    await fulfillEventStream(route, buildResultStream())
  })
  await openStudio(page)
  await uploadCharts(page, ['page-1.png', 'page-2.png'])
  await page.getByLabel('Analysis model').selectOption('gpt-5-mini')

  // Act
  await page.getByRole('button', { name: 'Analyze' }).click()

  // Assert
  await expect(page.getByRole('heading', { name: 'Fixture Song' })).toBeVisible()
  await expect(page.locator('[data-measure-id]')).toHaveCount(4)
  expect(requests).toHaveLength(1)
  expect(requests[0]?.model).toBe('gpt-5-mini')
  expect(requests[0]?.images.map(image => ({
    filename: image.filename,
    order: image.order,
  }))).toEqual([
    { filename: 'page-1.png', order: 0 },
    { filename: 'page-2.png', order: 1 },
  ])
  expect(requests[0]?.images.every(image =>
    image.dataUrl.startsWith('data:image/jpeg;base64,'),
  )).toBe(true)

  // Act
  await page.getByRole('textbox', { name: 'Chord', exact: true }).first().fill('Dm')
  await page.getByRole('textbox', { name: 'Lyrics', exact: true }).first().fill('edited lyric')
  await page.getByRole('combobox', { name: 'Style', exact: true }).selectOption('urban-groove')
  await page.getByRole('button', { name: 'Create Piano Score' }).click()

  // Assert
  await expect(page.locator('.score-workspace svg').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Simple' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Rich' })).toBeVisible()
  await expect(page.getByRole('spinbutton', { name: 'Playback BPM' })).toHaveValue('72')
  await expect(page.locator('.score-workspace')).toContainText('Dm')
  await expect(page.locator('.score-workspace')).toContainText('edited lyric')
  expect(browserErrors.consoleErrors).toEqual([])
  expect(browserErrors.pageErrors).toEqual([])
})

test('test_studio_when_stubbed_stream_fails_then_shows_error_and_retries_successfully', async ({ page }) => {
  // Arrange
  const browserErrors = observeBrowserErrors(page)
  let requestCount = 0
  await page.route('**/api/parse-chart', async route => {
    requestCount += 1
    await fulfillEventStream(
      route,
      requestCount === 1 ? buildErrorStream(QUOTA_ERROR_MESSAGE) : buildResultStream(),
    )
  })
  await openStudio(page)
  await uploadCharts(page, ['chart.png'])

  // Act
  await page.getByRole('button', { name: 'Analyze' }).click()

  // Assert
  await expect(page.getByText(QUOTA_ERROR_MESSAGE)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Analyze' })).toBeEnabled()
  await expect(page.locator('[data-measure-id]')).toHaveCount(0)

  // Act
  await page.getByRole('button', { name: 'Analyze' }).click()

  // Assert
  await expect(page.getByRole('heading', { name: 'Fixture Song' })).toBeVisible()
  await expect(page.locator('[data-measure-id]')).toHaveCount(4)
  await expect(page.getByText(QUOTA_ERROR_MESSAGE)).toHaveCount(0)
  expect(requestCount).toBe(2)
  expect(browserErrors.consoleErrors).toEqual([])
  expect(browserErrors.pageErrors).toEqual([])
})
