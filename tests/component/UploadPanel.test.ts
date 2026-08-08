// @vitest-environment nuxt
import { expect, test } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import UploadPanel from '../../components/UploadPanel.vue'
import { CHART_READING_MODEL_OPTIONS } from '../../shared/chart-reading/models'

const defaultProps = {
  fileNames: [] as string[],
  modelOptions: CHART_READING_MODEL_OPTIONS,
  selectedModel: 'gpt-5.5',
  isParsing: false,
  canAnalyze: false,
  statusText: null,
  errorMessage: null,
}

test('test_UploadPanel_when_models_are_available_then_renders_options_and_emits_selection', async () => {
  // Arrange
  const wrapper = await mountSuspended(UploadPanel, {
    props: defaultProps,
  })
  const select = wrapper.get('select[aria-label="Analysis model"]')

  // Act
  await select.setValue('gpt-5.6-sol')

  // Assert
  expect(select.findAll('option').map(option => option.text())).toEqual([
    'gpt-5-mini',
    'gpt-5.5',
    'gpt-5.6-sol',
  ])
  expect(wrapper.emitted('modelChanged')).toEqual([['gpt-5.6-sol']])
})

test('test_UploadPanel_when_files_are_selected_then_emits_files_and_renders_names', async () => {
  // Arrange
  const wrapper = await mountSuspended(UploadPanel, {
    props: {
      ...defaultProps,
      fileNames: ['first.png', 'second.jpg'],
      canAnalyze: true,
    },
  })
  const input = wrapper.get('input[type="file"]')
  const files = [
    new File(['first'], 'first.png', { type: 'image/png' }),
    new File(['second'], 'second.jpg', { type: 'image/jpeg' }),
  ]
  Object.defineProperty(input.element, 'files', {
    configurable: true,
    value: files,
  })

  // Act
  await input.trigger('change')

  // Assert
  expect(wrapper.get('[aria-label="Selected files"]').text()).toContain('first.png')
  expect(wrapper.get('[aria-label="Selected files"]').text()).toContain('second.jpg')
  expect(wrapper.emitted('filesSelected')).toEqual([[files]])
  expect(wrapper.get('button').attributes('disabled')).toBeUndefined()
})

test('test_UploadPanel_when_analysis_is_running_then_disables_model_and_emits_stop', async () => {
  // Arrange
  const wrapper = await mountSuspended(UploadPanel, {
    props: {
      ...defaultProps,
      fileNames: ['chart.png'],
      isParsing: true,
      canAnalyze: true,
      statusText: 'Analyzing 00:12',
      errorMessage: 'Previous request failed.',
    },
  })

  // Act
  await wrapper.get('button').trigger('click')

  // Assert
  expect(wrapper.get('select').attributes('disabled')).toBe('')
  expect(wrapper.text()).toContain('Analyzing 00:12')
  expect(wrapper.text()).toContain('Previous request failed.')
  expect(wrapper.get('button').text()).toBe('Stop')
  expect(wrapper.emitted('stop')).toEqual([[]])
})
