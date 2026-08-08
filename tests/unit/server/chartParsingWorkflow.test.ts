import { describe, expect, test } from 'vitest'
import type { z } from 'zod'
import {
  parseChartWorkflow,
  type ChartWorkflowTaskRunner,
} from '../../../server/services/chartParsingWorkflow'
import type { ChartTaskDefinition } from '../../../server/services/openaiChartTask'

describe('chart parsing workflow', () => {
  test('test_parseChartWorkflow_when_first_result_is_valid_then_calls_ai_once', async () => {
    // Arrange
    const calls: string[] = []
    const stubTaskRunner = buildTaskRunner((task) => {
      calls.push(task.id)
      return buildCompactChart()
    })

    // Act
    const chart = await parseChartWorkflow(buildWorkflowInput(stubTaskRunner))

    // Assert
    expect(calls).toEqual(['read-chart'])
    expect(chart.sections[0].measures[0].chords[0].chord.value).toBe('C')
  })

  test('test_parseChartWorkflow_when_task_succeeds_then_emits_job_completed_with_total_duration', async () => {
    // Arrange
    const events: Array<Record<string, unknown>> = []
    const timestamps = [100, 350]
    const stubTaskRunner = buildTaskRunner(() => buildCompactChart())

    // Act
    await parseChartWorkflow({
      ...buildWorkflowInput(stubTaskRunner),
      now: () => timestamps.shift() ?? 350,
      onEvent: event => events.push(event),
    })

    // Assert
    expect(events).toEqual([{
      type: 'job-completed',
      timestamp: 350,
      totalDurationMs: 250,
    }])
  })

  test('test_parseChartWorkflow_when_task_aborts_then_emits_job_stopped_once', async () => {
    // Arrange
    const events: Array<Record<string, unknown>> = []
    const timestamps = [100, 175]
    const controller = new AbortController()
    const stubTaskRunner = buildTaskRunner(() => {
      controller.abort()
      const error = new Error('stopped')
      error.name = 'AbortError'
      throw error
    })

    // Act & Assert
    await expect(parseChartWorkflow({
      ...buildWorkflowInput(stubTaskRunner),
      signal: controller.signal,
      now: () => timestamps.shift() ?? 175,
      onEvent: event => events.push(event),
    })).rejects.toMatchObject({ name: 'AbortError' })
    expect(events).toEqual([{
      type: 'job-stopped',
      timestamp: 175,
      totalDurationMs: 75,
    }])
  })

  test('test_parseChartWorkflow_when_signal_is_already_aborted_then_starts_no_tasks', async () => {
    // Arrange
    const calls: string[] = []
    const controller = new AbortController()
    controller.abort()
    const stubTaskRunner = buildTaskRunner((task) => {
      calls.push(task.id)
      return buildCompactChart()
    })

    // Act & Assert
    await expect(parseChartWorkflow({
      ...buildWorkflowInput(stubTaskRunner),
      signal: controller.signal,
    })).rejects.toMatchObject({ name: 'AbortError' })
    expect(calls).toEqual([])
  })
})

function buildWorkflowInput(taskRunner: ChartWorkflowTaskRunner) {
  return {
    client: { responses: { create: async () => ({ output_text: '{}' }) } },
    model: 'test-model',
    images: [{ filename: 'chart.jpeg', order: 0, dataUrl: 'data:image/jpeg;base64,abc' }],
    taskRunner,
  }
}

function buildTaskRunner(
  run: (task: ChartTaskDefinition<z.ZodType>) => unknown,
): ChartWorkflowTaskRunner {
  return async input => run(input.task) as never
}

function buildCompactChart(chords = [{ symbol: 'C', beats: 4 }]) {
  return {
    title: '楓',
    originalKey: 'C#',
    mode: 'major',
    meter: '4/4',
    tempo: 68,
    uncertainFields: [],
    moodRecommendation: {
      mood: 'spacious-ballad',
      uncertain: false,
      rationale: '',
    },
    sections: [{
      id: 'section-1',
      label: 'Verse',
      order: 1,
      uncertain: false,
      measures: [{
        index: 1,
        boundaryUncertain: false,
        lyric: null,
        lyricVariants: [],
        lyricUncertain: false,
        chords: chords.map(chord => ({
          ...chord,
          lyric: null,
          uncertainFields: [],
        })),
      }],
    }],
    annotations: [],
    warnings: [],
  }
}
