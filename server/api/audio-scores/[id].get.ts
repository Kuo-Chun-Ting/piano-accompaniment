import { defineEventHandler, getRouterParam, setHeader } from 'h3'
import { audioScoreJobs } from '../../utils/audioScoreJobs'

export default defineEventHandler((event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  return audioScoreJobs().get(getRouterParam(event, 'id') ?? '')
})
