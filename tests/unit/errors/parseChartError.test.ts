import { describe, expect, test } from 'vitest'
import { getParseChartErrorMessage } from '../../../shared/errors/parseChartError'

describe('parse chart error messages', () => {
  test('test_getParseChartErrorMessage_when_openai_quota_is_exceeded_then_returns_billing_message', () => {
    // Arrange
    const error = {
      statusCode: 429,
      data: {
        message: '429 You exceeded your current quota, please check your plan and billing details.',
      },
    }

    // Act
    const message = getParseChartErrorMessage(error)

    // Assert
    expect(message).toBe('OpenAI quota is unavailable. Check billing.')
  })

  test('test_getParseChartErrorMessage_when_model_is_invalid_then_returns_model_message', () => {
    // Arrange
    const error = {
      statusCode: 404,
      data: {
        message: 'The model gpt-5.6-sol does not exist or you do not have access to it.',
      },
    }

    // Act
    const message = getParseChartErrorMessage(error)

    // Assert
    expect(message).toBe('Selected model is unavailable. Choose another model.')
  })

  test('test_getParseChartErrorMessage_when_model_output_schema_fails_then_returns_format_message', () => {
    // Arrange
    const error = new Error('AI task output did not match chord_chart')

    // Act
    const message = getParseChartErrorMessage(error)

    // Assert
    expect(message).toBe('The model returned an unreadable chart format. Try another model or image.')
  })

  test('test_getParseChartErrorMessage_when_chart_image_is_explicitly_unreadable_then_returns_image_message', () => {
    // Arrange
    const error = {
      statusCode: 422,
      data: {
        message: 'Chart image is unreadable',
      },
    }

    // Act
    const message = getParseChartErrorMessage(error)

    // Assert
    expect(message).toBe('Could not read the chart image. Use a clear image with the full chord chart.')
  })

  test('test_getParseChartErrorMessage_when_runtime_config_is_missing_then_returns_config_message', () => {
    // Arrange
    const error = new Error('OpenAI runtime config is missing an API key')

    // Act
    const message = getParseChartErrorMessage(error)

    // Assert
    expect(message).toBe('Chart analysis is not configured. Check the API key.')
  })

  test('test_getParseChartErrorMessage_when_api_key_is_missing_then_returns_config_message', () => {
    // Arrange
    const error = new Error('OpenAI API key is missing')

    // Act
    const message = getParseChartErrorMessage(error)

    // Assert
    expect(message).toBe('Chart analysis is not configured. Check the API key.')
  })

  test('test_getParseChartErrorMessage_when_nested_response_reports_quota_then_returns_billing_message', () => {
    // Arrange
    const error = {
      response: {
        status: 429,
        _data: {
          message: 'insufficient_quota',
        },
      },
    }

    // Act
    const message = getParseChartErrorMessage(error)

    // Assert
    expect(message).toBe('OpenAI quota is unavailable. Check billing.')
  })

  test('test_getParseChartErrorMessage_when_error_is_user_facing_then_preserves_message', () => {
    // Arrange
    const error = new Error('Selected model is unavailable. Choose another model.')

    // Act
    const message = getParseChartErrorMessage(error)

    // Assert
    expect(message).toBe('Selected model is unavailable. Choose another model.')
  })

  test('test_getParseChartErrorMessage_when_server_connection_fails_then_returns_server_message', () => {
    // Arrange
    const error = new TypeError('Failed to fetch')

    // Act
    const message = getParseChartErrorMessage(error)

    // Assert
    expect(message).toBe('Analysis server is unavailable. Start the app server and try again.')
  })

  test('test_getParseChartErrorMessage_when_error_is_unknown_then_returns_unknown_message', () => {
    // Arrange
    const error = new Error('network failed')

    // Act
    const message = getParseChartErrorMessage(error)

    // Assert
    expect(message).toBe('An unexpected error occurred. Try again.')
  })
})
