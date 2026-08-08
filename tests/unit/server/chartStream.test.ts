import { describe, expect, test } from 'vitest'
import {
  ChartStreamMessageSchema,
  decodeChartStreamBlocks,
  encodeChartStreamMessage,
} from '../../../shared/schemas/chartStream'

describe('chart stream', () => {
  test('test_decodeChartStreamBlocks_when_chunk_splits_message_then_keeps_incomplete_remainder', () => {
    // Arrange
    const progressFrame = 'data: {"type":"progress","event":{"type":"task-started","taskId":"read-chart","kind":"reading-chart","title":"Reading chart","attempt":1,"timestamp":100}}\n\n'
    const errorFrame = 'data: {"type":"error","message":"quota unavailable"}\n\n'
    const splitIndex = progressFrame.length + 20
    const payload = `${progressFrame}${errorFrame}`

    // Act
    const partial = decodeChartStreamBlocks(payload.slice(0, splitIndex))
    const completed = decodeChartStreamBlocks(
      `${partial.remainder}${payload.slice(splitIndex)}`,
    )

    // Assert
    expect(partial.messages).toEqual([{
      type: 'progress',
      event: {
        type: 'task-started',
        taskId: 'read-chart',
        kind: 'reading-chart',
        title: 'Reading chart',
        attempt: 1,
        timestamp: 100,
      },
    }])
    expect(completed.messages).toEqual([{
      type: 'error',
      message: 'quota unavailable',
    }])
    expect(completed.remainder).toBe('')
  })

  test('test_encodeChartStreamMessage_when_error_is_encoded_then_returns_exact_sse_frame', () => {
    // Act
    const result = encodeChartStreamMessage({
      type: 'error',
      message: 'quota unavailable',
    })

    // Assert
    expect(result).toBe('data: {"type":"error","message":"quota unavailable"}\n\n')
  })

  test('test_ChartStreamMessageSchema_when_error_message_then_requires_message', () => {
    // Act & Assert
    expect(() => ChartStreamMessageSchema.parse({ type: 'error' })).toThrow()
  })
})
