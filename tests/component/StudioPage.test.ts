// @vitest-environment nuxt
import { beforeEach, expect, test, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { ref } from 'vue'
import StudioPage from '../../pages/index.vue'
import type { ArrangementSet } from '../../shared/arrangement/types'
import type {
  ConfirmChartSelection,
  ConfirmedChart,
  ExtractedChart,
  UploadedImage,
} from '../../shared/schemas/chart'
import { extractedChartFixture } from '../fixtures/extractedChart'

const mockUseChartWorkspace = vi.hoisted(() => vi.fn())

mockNuxtImport('useChartWorkspace', () => mockUseChartWorkspace)

let workspace: ReturnType<typeof buildWorkspace>

beforeEach(() => {
  vi.clearAllMocks()
  workspace = buildWorkspace()
  mockUseChartWorkspace.mockReturnValue(workspace)
})

test('test_StudioPage_when_chart_is_unavailable_then_renders_upload_workspace', async () => {
  // Arrange & Act
  const wrapper = await mountStudioPage()

  // Assert
  expect(wrapper.findComponent({ name: 'UploadPanel' }).exists()).toBe(true)
  expect(wrapper.find('[aria-label="Workspace view"]').exists()).toBe(false)
  expect(wrapper.find('[data-test="chart-comparison"]').exists()).toBe(false)
})

test('test_StudioPage_when_chart_has_no_score_then_renders_chart_and_disables_score_view', async () => {
  // Arrange
  workspace.extractedChart.value = structuredClone(extractedChartFixture)

  // Act
  const wrapper = await mountStudioPage()

  // Assert
  expect(wrapper.get('h2').text()).toBe('Fixture Song')
  expect(wrapper.get('[data-test="chart-comparison"]').isVisible()).toBe(true)
  expect(wrapper.get('[aria-label="Workspace view"] button:last-child').attributes('disabled')).toBe('')
})

test('test_StudioPage_when_chart_is_confirmed_then_switches_to_score_view', async () => {
  // Arrange
  workspace.extractedChart.value = structuredClone(extractedChartFixture)
  workspace.confirmChart.mockImplementation(() => {
    workspace.confirmedChart.value = buildConfirmedChart()
    workspace.arrangements.value = buildArrangementSet()
  })
  const wrapper = await mountStudioPage()

  // Act
  await wrapper.get('[data-test="confirm-chart"]').trigger('click')

  // Assert
  expect(workspace.confirmChart).toHaveBeenCalledWith(expect.objectContaining({
    normalizedKey: 'C',
    mood: 'spacious-ballad',
  }))
  expect(wrapper.get('[aria-label="Workspace view"] button:last-child').classes()).toContain('active')
  expect(wrapper.get('[data-test="arrangement-grid"]').isVisible()).toBe(true)
})

async function mountStudioPage() {
  return mountSuspended(StudioPage, {
    global: {
      stubs: {
        ChartComparison: {
          props: ['images', 'contentId', 'disabled'],
          emits: ['filesSelected', 'clear'],
          template: '<section data-test="chart-comparison"><slot /></section>',
        },
        ChartReview: {
          props: ['chart'],
          emits: ['confirm'],
          data: () => ({
            selection: {
              normalizedKey: 'C',
              mood: 'spacious-ballad',
              sections: [],
            } satisfies ConfirmChartSelection,
          }),
          template: '<button data-test="confirm-chart" @click="$emit(\'confirm\', selection)">Confirm</button>',
        },
        ArrangementGrid: {
          props: ['active', 'arrangements', 'chart'],
          template: '<section data-test="arrangement-grid">Score</section>',
        },
      },
    },
  })
}

function buildWorkspace() {
  return {
    uploadedImages: ref<UploadedImage[]>([]),
    extractedChart: ref<ExtractedChart | null>(null),
    confirmedChart: ref<ConfirmedChart | null>(null),
    arrangements: ref<ArrangementSet | null>(null),
    isParsing: ref(false),
    parsingElapsedSeconds: ref(0),
    lastParsingElapsedSeconds: ref(0),
    chartReadingStatus: ref<'idle' | 'reading' | 'success' | 'failed'>('idle'),
    selectedModel: ref('gpt-5.5'),
    error: ref<{ message: string } | null>(null),
    setFiles: vi.fn(),
    parseUploadedImages: vi.fn(),
    stopParsing: vi.fn(),
    setReadingModel: vi.fn(),
    confirmChart: vi.fn(),
    clearWorkspace: vi.fn(),
  }
}

function buildConfirmedChart(): ConfirmedChart {
  return {
    title: 'Fixture Song',
    originalKey: 'C',
    mode: 'major',
    normalizedKey: 'C',
    meter: '4/4',
    tempo: 72,
    mood: 'spacious-ballad',
    sections: [],
  }
}

function buildArrangementSet(): ArrangementSet {
  return {
    mood: 'spacious-ballad',
    versions: [],
    blockingIssues: [],
  }
}
