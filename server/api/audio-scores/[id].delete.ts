import { defineEventHandler, getRouterParam, setResponseStatus } from 'h3'
import { audioScoreJobs } from '../../utils/audioScoreJobs'

export default defineEventHandler((event) => {
  audioScoreJobs().cancel(getRouterParam(event, 'id') ?? '')
  setResponseStatus(event, 202)
  return { ok: true }
})
