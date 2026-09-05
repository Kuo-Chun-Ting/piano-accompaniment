import { expect, test } from '@playwright/test'
import { buildAudioScoreFixture, buildAudioWavFixture } from '../fixtures/audioScore'

test('test_audio_studio_when_file_selected_or_replaced_then_preserves_control_positions', async ({ page }) => {
  // Arrange
  await page.goto('/')
  await page.waitForFunction(() => '__vue_app__' in (document.querySelector('#__nuxt') ?? {}))
  const create = page.getByRole('button', { name: 'Create Score', exact: true })
  const target = page.locator('.drop-zone label')
  await expect(create).toBeDisabled()
  const initialPicker = await target.boundingBox()
  const initialCreate = await create.boundingBox()
  // Act: the same picker is available before and after selection.
  const chooserPromise = page.waitForEvent('filechooser')
  await target.click({ position: { x: 12, y: 12 } })
  await (await chooserPromise).setFiles({ name: 'first.wav', mimeType: 'audio/wav', buffer: buildAudioWavFixture(1) })
  // Assert
  await expect(target).toContainText('first.wav')
  expect(await target.boundingBox()).toEqual(initialPicker)
  expect(await create.boundingBox()).toEqual(initialCreate)
  await expect(page.locator('.drop-zone')).toContainText('first.wav')
  await expect(page.getByRole('button', { name: 'Create Score', exact: true })).toBeEnabled()
  // Act: the picker remains accessible by keyboard.
  const replacementPromise = page.waitForEvent('filechooser')
  await page.getByLabel('Audio file', { exact: true }).focus()
  await page.keyboard.press('Enter')
  await (await replacementPromise).setFiles({ name: 'second.wav', mimeType: 'audio/wav', buffer: buildAudioWavFixture(1) })
  // Assert
  await expect(page.locator('.drop-zone')).toContainText('second.wav')
  await expect(page.locator('.drop-zone')).not.toContainText('first.wav')
  // Dropping a new file replaces the selection without opening a picker.
  const transfer = await page.evaluateHandle(() => {
    const data = new DataTransfer()
    data.items.add(new File(['RIFF0000WAVEtest'], 'dropped.wav', { type: 'audio/wav' }))
    return data
  })
  await page.locator('.drop-zone').dispatchEvent('dragover', { dataTransfer: transfer })
  await expect(page.locator('.drop-zone')).toHaveClass(/dragging/)
  await page.locator('.drop-zone').dispatchEvent('drop', { dataTransfer: transfer })
  await expect(target).toContainText('dropped.wav')
  await expect(page.locator('.drop-zone')).not.toHaveClass(/dragging/)
  await transfer.dispose()
  await page.setViewportSize({ width: 390, height: 844 })
  const row = await page.locator('.drop-zone').boundingBox()
  expect(row!.x + row!.width).toBeLessThanOrEqual(390)
  const mobileCreate = await create.boundingBox()
  await page.getByLabel('Audio file', { exact: true }).setInputFiles({
    name: 'a-very-long-recording-name-that-must-not-push-the-controls-outside-the-screen.wav',
    mimeType: 'audio/wav', buffer: buildAudioWavFixture(1),
  })
  expect(await create.boundingBox()).toEqual(mobileCreate)
  const picker = await target.boundingBox()
  expect(picker!.x + picker!.width).toBeLessThanOrEqual(390)
  // Remove must not open the picker underneath it.
  let pickersOpened = 0
  page.on('filechooser', () => { pickersOpened++ })
  await page.getByRole('button', { name: 'Remove file', exact: true }).click()
  await expect(target).toContainText('Choose or drop a WAV file')
  await expect(create).toBeDisabled()
  expect(await create.boundingBox()).toEqual(mobileCreate)
  expect(pickersOpened).toBe(0)
})

test('test_audio_studio_when_uploaded_then_renders_restores_and_seeks_native_reference_audio', async ({ page }) => {
  // Arrange: only the transcription backend is stubbed, not browser audio or score rendering.
  const wav = buildAudioWavFixture()
  const result = buildAudioScoreFixture()
  result.referenceAudio!.src = '/fixture-piano.wav'
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    const NativeAudio = window.Audio
    window.Audio = class extends NativeAudio {
      constructor(src?: string) { super(src); Reflect.set(window, '__testAudio', this) }
    }
  })
  let polls = 0
  await page.route('**/api/audio-scores', async route => {
    expect(route.request().headers()['x-audio-filename']).toBe(encodeURIComponent('楓.wav'))
    expect(route.request().postDataBuffer()?.subarray(0, 4).toString()).toBe('RIFF')
    await route.fulfill({ status: 202, json: { id: 'fixture', title: '楓', status: 'running', stage: 'starting' } })
  })
  await page.route('**/api/audio-scores/fixture', route => route.fulfill({ json: ++polls < 2
    ? { id: 'fixture', title: '楓', status: 'running', stage: 'separate-piano' }
    : { id: 'fixture', title: '楓', status: 'succeeded', stage: 'build-viewer', result } }))
  await page.route('**/fixture-piano.wav', route => {
    const range = /^bytes=(\d+)-(\d*)$/.exec(route.request().headers().range ?? '')
    const start = range ? Number(range[1]) : 0
    const end = range?.[2] ? Number(range[2]) : wav.length - 1
    return route.fulfill({
      status: range ? 206 : 200, contentType: 'audio/wav', body: wav.subarray(start, end + 1),
      headers: { 'Accept-Ranges': 'bytes', ...(range ? { 'Content-Range': `bytes ${start}-${end}/${wav.length}` } : {}) },
    })
  })
  await page.goto('/')
  await page.waitForFunction(() => '__vue_app__' in (document.querySelector('#__nuxt') ?? {}))
  // Act
  await expect(page.getByRole('button', { name: 'Chord Sheet Image', exact: true })).toBeDisabled()
  await page.getByLabel('Audio file', { exact: true }).setInputFiles({ name: '楓.wav', mimeType: 'audio/wav', buffer: wav })
  await page.getByRole('button', { name: 'Create Score', exact: true }).click()
  // Assert
  await expect(page.getByRole('status')).toContainText('Separating piano')
  await expect(page.locator('.score-system svg').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Rich', exact: true })).toHaveCount(0)
  // Act: restore and seek from early playback directly to the tenth measure.
  await page.reload()
  await expect(page.locator('.score-system svg').first()).toBeVisible()
  await page.getByLabel('Playback source', { exact: true }).click()
  await page.getByRole('menuitemradio', { name: 'Original Piano', exact: true }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  const progress = page.getByLabel('Playback progress')
  await progress.fill('0.75')
  await progress.dispatchEvent('change')
  await expect.poll(() => page.evaluate(() => (Reflect.get(window, '__testAudio') as HTMLAudioElement).currentTime)).toBeGreaterThanOrEqual(20)
  await progress.fill('0.1')
  await progress.dispatchEvent('change')
  await expect.poll(() => page.evaluate(() => (Reflect.get(window, '__testAudio') as HTMLAudioElement).currentTime)).toBeLessThan(6)
  await page.getByRole('button', { name: 'Stop', exact: true }).click()
  // Assert: transport stays together and tempo does not cover the time on a narrow screen.
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeVisible()
  const playerBox = await page.locator('.player-controls').boundingBox()
  const tempoBox = await page.locator('.tempo-control').boundingBox()
  expect(playerBox!.x + playerBox!.width).toBeLessThanOrEqual(390)
  expect(tempoBox!.y).toBeGreaterThanOrEqual(playerBox!.y + playerBox!.height)
  await page.setViewportSize({ width: 1280, height: 720 })
  expect(errors).toEqual([])
  await page.getByRole('button', { name: 'New Upload' }).click()
  await expect(page.getByRole('button', { name: 'Chord Sheet Image' })).toBeDisabled()
})

test('test_audio_studio_when_transcription_fails_then_can_retry_and_cancel', async ({ page }) => {
  // Arrange
  let submissions = 0
  let cancelled = false
  await page.route('**/api/audio-scores', route => {
    submissions++
    return route.fulfill({ status: 202, json: { id: 'retry', title: 'song', status: 'running', stage: 'starting' } })
  })
  await page.route('**/api/audio-scores/retry', route => {
    if (route.request().method() === 'DELETE') cancelled = true
    return route.fulfill({ json: {
      id: 'retry', title: 'song', stage: 'transcribe-midi',
      status: cancelled ? 'cancelled' : submissions === 1 ? 'failed' : 'running',
      error: submissions === 1 ? 'Transcription failed. Please retry.' : undefined,
    } })
  })
  await page.goto('/')
  await page.waitForFunction(() => '__vue_app__' in (document.querySelector('#__nuxt') ?? {}))
  await page.getByLabel('Audio file', { exact: true }).setInputFiles({ name: 'song.wav', mimeType: 'audio/wav', buffer: buildAudioWavFixture(1) })
  // Act & Assert
  await page.getByRole('button', { name: 'Create Score', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Transcription failed')
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Transcribing notes')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('cancelled')
})
