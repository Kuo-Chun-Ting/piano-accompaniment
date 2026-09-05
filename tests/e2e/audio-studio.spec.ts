import { expect, test } from '@playwright/test'
import { buildAudioScoreFixture, buildAudioWavFixture } from '../fixtures/audioScore'

test('test_audio_studio_when_file_selected_then_previews_locally_and_clears_without_upload', async ({ page }) => {
  // Arrange
  const uploads: string[] = []
  page.on('request', request => { if (request.method() === 'POST') uploads.push(request.url()) })
  await page.goto('/')
  await page.waitForFunction(() => '__vue_app__' in (document.querySelector('#__nuxt') ?? {}))
  const create = page.getByRole('button', { name: 'Transcribe', exact: true })
  const target = page.locator('.file-picker')
  await expect(create).toHaveCount(0)
  await expect(target).toContainText('Max 100 MB')
  // Act: choose a real WAV, without submitting it to the server.
  const chooserPromise = page.waitForEvent('filechooser')
  await target.click()
  await (await chooserPromise).setFiles({ name: 'first.wav', mimeType: 'audio/wav', buffer: buildAudioWavFixture(8) })
  // Assert
  await expect(page.locator('.file-info')).toContainText('first.wav')
  await expect(create).toBeEnabled()
  expect((await create.boundingBox())!.y).toBeGreaterThan((await page.locator('.drop-zone').boundingBox())!.y)
  const preview = page.getByRole('region', { name: 'Audio preview' })
  const media = preview.locator('audio')
  await expect(preview.getByRole('button', { name: 'Play', exact: true })).toBeEnabled()
  expect(await media.evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(true)
  expect(await media.evaluate((audio: HTMLAudioElement) => audio.currentSrc)).toMatch(/^blob:/)
  await expect(preview.getByRole('button', { name: 'Stop' })).toHaveCount(0)
  // Act: play, pause, seek both directions, and resume from the new time.
  await preview.getByRole('button', { name: 'Play', exact: true }).click()
  await expect.poll(() => media.evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeGreaterThan(0)
  await preview.getByRole('button', { name: 'Pause', exact: true }).click()
  expect(await media.evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(true)
  const progress = preview.getByLabel('Playback progress')
  await progress.fill('0.75')
  await progress.dispatchEvent('change')
  await expect.poll(() => media.evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeCloseTo(6, 1)
  await progress.fill('0.25')
  await progress.dispatchEvent('change')
  await expect.poll(() => media.evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeCloseTo(2, 1)
  await preview.getByRole('button', { name: 'Play', exact: true }).click()
  await expect.poll(() => media.evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeGreaterThan(2)
  // Dropping a new file replaces the selection without opening a picker.
  const transfer = await page.evaluateHandle(() => {
    const data = new DataTransfer()
    const audio = document.querySelector('audio')!
    Reflect.set(window, '__oldPreviewAudio', audio)
    data.items.add(new File(['RIFF0000WAVEtest'], 'a-very-long-recording-name-that-must-not-push-the-controls-outside-the-screen.wav', { type: 'audio/wav' }))
    return data
  })
  await page.locator('.drop-zone').dispatchEvent('dragover', { dataTransfer: transfer })
  await expect(page.locator('.drop-zone')).toHaveClass(/dragging/)
  await page.locator('.drop-zone').dispatchEvent('drop', { dataTransfer: transfer })
  await expect(page.locator('.filename')).toContainText('a-very-long-recording')
  expect(await page.evaluate(() => (Reflect.get(window, '__oldPreviewAudio') as HTMLAudioElement).paused)).toBe(true)
  await expect(page.locator('.drop-zone')).not.toHaveClass(/dragging/)
  await transfer.dispose()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('heading', { name: 'Piano Accompaniment Studio', exact: true })).toBeVisible()
  const row = await page.locator('.drop-zone').boundingBox()
  expect(row!.x + row!.width).toBeLessThanOrEqual(390)
  const nameBounds = await page.locator('.filename').boundingBox()
  const removeBounds = await page.getByRole('button', { name: 'Remove file', exact: true }).boundingBox()
  expect(nameBounds!.x + nameBounds!.width).toBeLessThanOrEqual(removeBounds!.x)
  await expect(page.locator('.filename')).toHaveAttribute('title', 'a-very-long-recording-name-that-must-not-push-the-controls-outside-the-screen.wav')
  await expect(page.locator('.filename-tail')).toHaveText('reen.wav')
  expect(await page.locator('.filename-start').evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true)
  const previewBox = await preview.boundingBox()
  const fileBox = await page.locator('.file-info').boundingBox()
  expect(previewBox!.x + previewBox!.width).toBeLessThanOrEqual(390)
  expect(previewBox!.y - (fileBox!.y + fileBox!.height)).toBeGreaterThanOrEqual(12)
  // Remove must not open the picker underneath it.
  let pickersOpened = 0
  page.on('filechooser', () => { pickersOpened++ })
  await page.getByRole('button', { name: 'Remove file', exact: true }).click()
  await expect(target).toContainText('Choose a WAV file')
  await expect(create).toHaveCount(0)
  await expect(preview).toHaveCount(0)
  expect(pickersOpened).toBe(0)
  expect(uploads).toEqual([])
  // The empty note remains keyboard accessible after clearing.
  const keyboardChooser = page.waitForEvent('filechooser')
  await page.getByLabel('Audio file', { exact: true }).focus()
  await page.keyboard.press('Enter')
  await (await keyboardChooser).setFiles({ name: 'second.wav', mimeType: 'audio/wav', buffer: buildAudioWavFixture(1) })
  await expect(create).toBeEnabled()
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
  await expect(page.getByRole('group', { name: 'Input source' })).toHaveCount(0)
  await page.getByLabel('Audio file', { exact: true }).setInputFiles({ name: '楓.wav', mimeType: 'audio/wav', buffer: wav })
  await page.getByRole('button', { name: 'Transcribe', exact: true }).click()
  // Assert
  await expect(page.getByRole('status')).toContainText('Transcribing')
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
  await expect(page.getByRole('button', { name: 'Chord Sheet Image' })).toHaveCount(0)
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
  await page.getByRole('button', { name: 'Transcribe', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Transcription failed')
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Transcribing')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('status')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Transcribe', exact: true })).toBeEnabled()
})

test('test_audio_studio_when_dragging_during_transcription_then_keeps_preview_interactive', async ({ page }) => {
  // Arrange: real browser audio and pointer events, only the model job is stubbed.
  await page.route('**/api/audio-scores', route => route.fulfill({ status: 202, json: { id: 'playing', title: 'song', status: 'running', stage: 'starting' } }))
  await page.route('**/api/audio-scores/playing', route => route.fulfill({ json: { id: 'playing', title: 'song', status: 'running', stage: 'transcribe-midi' } }))
  await page.goto('/')
  await page.waitForFunction(() => '__vue_app__' in (document.querySelector('#__nuxt') ?? {}))
  await page.getByLabel('Audio file', { exact: true }).setInputFiles({ name: 'song.wav', mimeType: 'audio/wav', buffer: buildAudioWavFixture(30) })
  const preview = page.getByRole('region', { name: 'Audio preview' })
  const media = preview.locator('audio')
  const slider = preview.getByLabel('Playback progress')
  await preview.getByRole('button', { name: 'Play', exact: true }).click()
  await expect.poll(() => media.evaluate((a: HTMLAudioElement) => a.currentTime)).toBeGreaterThan(0)
  // Act: starting a job must not interrupt playback.
  await page.getByRole('button', { name: 'Transcribe', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Transcribing')
  await expect(preview.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled()
  for (const fraction of [0.8, 0.2]) {
    const box = (await slider.boundingBox())!
    const current = Number(await slider.inputValue())
    await page.mouse.move(box.x + 8 + current * (box.width - 16), box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + 8 + fraction * (box.width - 16), box.y + box.height / 2, { steps: 15 })
    // Hold longer than multiple media timeupdate events: the previous bug overwrote the thumb here.
    await page.waitForTimeout(1200)
    expect(Number(await slider.inputValue())).toBeCloseTo(fraction, 1)
    await page.mouse.up()
    await expect.poll(() => media.evaluate((a: HTMLAudioElement) => a.currentTime)).toBeGreaterThan(fraction * 30 - 1)
    expect(await media.evaluate((a: HTMLAudioElement) => a.currentTime)).toBeLessThan(fraction * 30 + 2)
  }
  // Assert: pause is still available while the job runs.
  await preview.getByRole('button', { name: 'Pause', exact: true }).click()
  expect(await media.evaluate((a: HTMLAudioElement) => a.paused)).toBe(true)
})
