import { createError, defineEventHandler, getHeader, setResponseStatus } from 'h3'
import { MAX_AUDIO_UPLOAD_BYTES } from '../../../shared/audio-transcription/job'
import { audioScoreJobs } from '../../utils/audioScoreJobs'

export default defineEventHandler(async (event) => {
  if (getHeader(event, 'content-type') !== 'audio/wav') {
    throw createError({ statusCode: 415, message: 'Upload a WAV file.' })
  }
  if (Number(getHeader(event, 'content-length')) > MAX_AUDIO_UPLOAD_BYTES) {
    throw createError({ statusCode: 413, message: 'WAV files must be 100 MB or smaller.' })
  }
  let filename: string
  try { filename = decodeURIComponent(getHeader(event, 'x-audio-filename') ?? '') }
  catch { throw createError({ statusCode: 400, message: 'Invalid file name.' }) }
  const job = await audioScoreJobs().submit(filename, event.node.req)
  setResponseStatus(event, 202)
  return job
})
