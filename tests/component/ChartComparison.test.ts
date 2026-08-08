// @vitest-environment nuxt
import { expect, test } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ChartComparison from '../../components/ChartComparison.vue'
import type { UploadedImage } from '../../shared/schemas/chart'

const images: UploadedImage[] = [
  { filename: 'first.png', order: 0, dataUrl: 'data:image/png;base64,Zmlyc3Q=' },
  { filename: 'second.png', order: 1, dataUrl: 'data:image/png;base64,c2Vjb25k' },
]

test('test_ChartComparison_when_image_tab_is_selected_then_displays_selected_image', async () => {
  // Arrange
  const wrapper = await mountSuspended(ChartComparison, {
    props: { images, contentId: 'chart' },
  })

  // Act
  await wrapper.get('[aria-label="Chart images"] button:nth-child(2)').trigger('click')

  // Assert
  expect(wrapper.get('.source-title span').text()).toBe('second.png')
  expect(wrapper.get('img').attributes()).toMatchObject({
    alt: 'Uploaded chart 2',
    src: images[1].dataUrl,
  })
})

test('test_ChartComparison_when_images_are_replaced_then_selects_first_image', async () => {
  // Arrange
  const wrapper = await mountSuspended(ChartComparison, {
    props: { images, contentId: 'chart' },
  })
  await wrapper.get('[aria-label="Chart images"] button:nth-child(2)').trigger('click')
  const replacement = [
    { filename: 'replacement.png', order: 0, dataUrl: 'data:image/png;base64,bmV3' },
  ]

  // Act
  await wrapper.setProps({ images: replacement })

  // Assert
  expect(wrapper.get('.source-title span').text()).toBe('replacement.png')
  expect(wrapper.get('img').attributes('src')).toBe(replacement[0].dataUrl)
})

test('test_ChartComparison_when_source_controls_are_used_then_emits_files_and_clear', async () => {
  // Arrange
  const wrapper = await mountSuspended(ChartComparison, {
    props: { images, contentId: 'chart' },
  })
  const input = wrapper.get('input[type="file"]')
  const files = [new File(['chart'], 'chart.png', { type: 'image/png' })]
  Object.defineProperty(input.element, 'files', {
    configurable: true,
    value: files,
  })

  // Act
  await input.trigger('change')
  await wrapper.get('button.clear-button').trigger('click')
  await wrapper.get('button[aria-label="Zoom in"]').trigger('click')

  // Assert
  expect(wrapper.emitted('filesSelected')).toEqual([[files]])
  expect(wrapper.emitted('clear')).toEqual([[]])
  expect(wrapper.get('.zoom-controls button:nth-child(2)').text()).toBe('125%')
})

test('test_ChartComparison_when_disabled_then_disables_destructive_source_controls', async () => {
  // Arrange & Act
  const wrapper = await mountSuspended(ChartComparison, {
    props: { images, contentId: 'chart', disabled: true },
  })

  // Assert
  expect(wrapper.get('input[type="file"]').attributes('disabled')).toBe('')
  expect(wrapper.get('button.clear-button').attributes('disabled')).toBe('')
})
