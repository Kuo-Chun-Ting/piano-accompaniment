const UNREADABLE_CHART_IMAGE_ERROR_MESSAGE = 'Could not read the chart image. Use a clear image with the full chord chart.'
const OPENAI_QUOTA_ERROR_MESSAGE = 'OpenAI quota is unavailable. Check billing.'
const INVALID_MODEL_ERROR_MESSAGE = 'Selected model is unavailable. Choose another model.'
const INVALID_MODEL_OUTPUT_ERROR_MESSAGE = 'The model returned an unreadable chart format. Try another model or image.'
const CONFIG_ERROR_MESSAGE = 'Chart analysis is not configured. Check the API key.'
const SERVER_UNAVAILABLE_ERROR_MESSAGE = 'Analysis server is unavailable. Start the app server and try again.'
const UNKNOWN_PARSE_ERROR_MESSAGE = 'An unexpected error occurred. Try again.'

const USER_FACING_ERROR_MESSAGES = new Set([
  UNREADABLE_CHART_IMAGE_ERROR_MESSAGE,
  OPENAI_QUOTA_ERROR_MESSAGE,
  INVALID_MODEL_ERROR_MESSAGE,
  INVALID_MODEL_OUTPUT_ERROR_MESSAGE,
  CONFIG_ERROR_MESSAGE,
  SERVER_UNAVAILABLE_ERROR_MESSAGE,
  UNKNOWN_PARSE_ERROR_MESSAGE,
])

type ErrorLike = {
  status?: number
  statusCode?: number
  message?: string
  data?: {
    message?: string
    statusCode?: number
  }
  response?: {
    status?: number
    statusText?: string
    _data?: {
      message?: string
      statusCode?: number
    }
  }
}

export function getParseChartErrorMessage(error: unknown): string {
  const message = collectErrorMessage(error)

  if (USER_FACING_ERROR_MESSAGES.has(message)) {
    return message
  }

  if (isOpenAIQuotaError(error)) {
    return OPENAI_QUOTA_ERROR_MESSAGE
  }

  if (isInvalidModelError(error)) {
    return INVALID_MODEL_ERROR_MESSAGE
  }

  if (isUnreadableChartImageError(error)) {
    return UNREADABLE_CHART_IMAGE_ERROR_MESSAGE
  }

  if (isInvalidModelOutputError(message)) {
    return INVALID_MODEL_OUTPUT_ERROR_MESSAGE
  }

  if (isConfigError(message)) {
    return CONFIG_ERROR_MESSAGE
  }

  if (isServerConnectionError(message)) {
    return SERVER_UNAVAILABLE_ERROR_MESSAGE
  }

  return UNKNOWN_PARSE_ERROR_MESSAGE
}

function isOpenAIQuotaError(error: unknown): boolean {
  const statusCode = getStatusCode(error)
  const message = collectErrorMessage(error)

  return statusCode === 429
    || includesAny(message, ['exceeded your current quota', 'insufficient_quota'])
}

function isInvalidModelError(error: unknown): boolean {
  const statusCode = getStatusCode(error)
  const message = collectErrorMessage(error)

  return (statusCode === 400 || statusCode === 404)
    && includesAny(message, ['model', 'does not exist', 'invalid model'])
}

function isUnreadableChartImageError(error: unknown): boolean {
  return getStatusCode(error) === 422
    && includesAny(collectErrorMessage(error), ['chart image is unreadable', 'chart image could not be read'])
}

function isInvalidModelOutputError(message: string): boolean {
  return includesAny(message, [
    'AI task output did not include valid JSON',
    'AI task output did not match',
    'Model response did not match chart schema',
  ])
}

function isConfigError(message: string): boolean {
  return includesAny(message, ['OpenAI runtime config is missing', 'OpenAI API key is missing'])
}

function isServerConnectionError(message: string): boolean {
  return includesAny(message, ['Failed to fetch', 'Load failed', 'NetworkError', 'fetch failed'])
}

function getStatusCode(error: unknown): number | undefined {
  const errorLike = error as ErrorLike

  return errorLike.statusCode || errorLike.status || errorLike.data?.statusCode || errorLike.response?.status
}

function collectErrorMessage(error: unknown): string {
  const errorLike = error as ErrorLike

  return [
    errorLike.message,
    errorLike.data?.message,
    errorLike.response?.statusText,
    errorLike.response?._data?.message,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ')
}

function includesAny(message: string, patterns: string[]): boolean {
  const normalizedMessage = message.toLowerCase()

  return patterns.some(pattern => normalizedMessage.includes(pattern.toLowerCase()))
}
