import { defineEventHandler, getHeader, getRouterParam, setHeader } from 'h3'
import { audioScoreJobs } from '../../../utils/audioScoreJobs'
import { sendRangeFile } from '../../../services/rangeFile'

export default defineEventHandler(async (event) => {
  const path = await audioScoreJobs().audioPath(getRouterParam(event, 'id') ?? '')
  setHeader(event, 'Cache-Control', 'private, no-store')
  await sendRangeFile(event.node.res, path, 'audio/wav', getHeader(event, 'range'), event.method === 'HEAD')
})
