import { describe, expect, test } from 'vitest'
import { buildReadingChartTask } from '../../../server/services/chartTaskPrompts'
import { runChartTask } from '../../../server/services/openaiChartTask'

describe('openai chart task', () => {
  test('test_runChartTask_when_images_are_out_of_order_then_sends_prompt_images_in_source_order_and_signal', async () => {
    // Arrange
    const captured: {
      request: Record<string, any> | null
      options: Record<string, any> | null
    } = { request: null, options: null }
    const controller = new AbortController()
    const mockClient = {
      responses: {
        create: async (request: Record<string, any>, options?: Record<string, any>) => {
          captured.request = request
          captured.options = options ?? null
          return { output_text: JSON.stringify(buildCompactChart()) }
        },
      },
    }
    const task = buildReadingChartTask()

    // Act
    const result = await runChartTask({
      client: mockClient,
      model: 'test-model',
      task,
      images: [
        { filename: 'second.jpeg', order: 2, dataUrl: 'data:image/jpeg;base64,second' },
        { filename: 'first.jpeg', order: 1, dataUrl: 'data:image/jpeg;base64,first' },
      ],
      signal: controller.signal,
    })

    // Assert
    expect(result.sections[0].measures[0].lyric).toBe('烏雲在我們心裡')
    expect(captured.request?.input?.[0]?.content).toEqual([
      { type: 'input_text', text: task.prompt },
      { type: 'input_image', image_url: 'data:image/jpeg;base64,first', detail: 'high' },
      { type: 'input_image', image_url: 'data:image/jpeg;base64,second', detail: 'high' },
    ])
    expect(captured.options?.signal).toBe(controller.signal)
  })

  test('test_runChartTask_when_task_completes_then_reports_started_raw_output_and_duration', async () => {
    // Arrange
    const events: Array<Record<string, unknown>> = []
    const rawOutputs: Array<{ taskId: string, output: string }> = []
    const timestamps = [100, 350]
    const output = JSON.stringify(buildCompactChart())
    const stubClient = {
      responses: {
        create: async () => ({ output_text: output }),
      },
    }

    // Act
    await runChartTask({
      client: stubClient,
      model: 'test-model',
      task: buildReadingChartTask(),
      images: [],
      now: () => timestamps.shift() ?? 350,
      onEvent: event => events.push(event),
      onRawOutput: (taskId, value) => rawOutputs.push({ taskId, output: value }),
    })

    // Assert
    expect(events).toEqual([{
      type: 'task-started',
      taskId: 'read-chart',
      kind: 'reading-chart',
      title: 'Reading chart',
      attempt: 1,
      timestamp: 100,
    }, {
      type: 'task-completed',
      taskId: 'read-chart',
      kind: 'reading-chart',
      title: 'Reading chart',
      attempt: 1,
      timestamp: 350,
      durationMs: 250,
    }])
    expect(rawOutputs).toEqual([{ taskId: 'read-chart', output }])
  })

  test('test_runChartTask_when_output_is_invalid_then_reports_failed_task', async () => {
    // Arrange
    const events: Array<Record<string, unknown>> = []
    const timestamps = [10, 20]
    const stubClient = {
      responses: {
        create: async () => ({ output_text: '{"lines":"wrong"}' }),
      },
    }

    // Act & Assert
    await expect(runChartTask({
      client: stubClient,
      model: 'test-model',
      task: buildReadingChartTask(),
      images: [],
      now: () => timestamps.shift() ?? 20,
      onEvent: event => events.push(event),
    })).rejects.toThrow('AI task output did not match chord_chart')
    expect(events[1]).toMatchObject({
      type: 'task-failed',
      taskId: 'read-chart',
      durationMs: 10,
    })
  })

  test('test_runChartTask_when_output_is_not_json_then_emits_failed_event_and_throws_json_error', async () => {
    // Arrange
    const events: Array<Record<string, unknown>> = []
    const stubClient = {
      responses: {
        create: async () => ({ output_text: 'not json' }),
      },
    }

    // Act & Assert
    await expect(runChartTask({
      client: stubClient,
      model: 'test-model',
      task: buildReadingChartTask(),
      images: [],
      now: () => 20,
      onEvent: event => events.push(event),
    })).rejects.toThrow('AI task output did not include valid JSON for chord_chart')
    expect(events.at(-1)).toMatchObject({
      type: 'task-failed',
      taskId: 'read-chart',
      message: 'AI task output did not include valid JSON for chord_chart',
    })
  })
})

function buildCompactChart() {
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
        lyric: '烏雲在我們心裡',
        lyricVariants: [],
        lyricUncertain: false,
        chords: [{ symbol: 'C', beats: 4, uncertainFields: [] }],
      }],
    }],
    annotations: [],
    warnings: [],
  }
}
