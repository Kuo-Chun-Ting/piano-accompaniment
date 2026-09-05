import { audioScoreJobs } from '../utils/audioScoreJobs'

export default defineNitroPlugin((app) => {
  app.hooks.hook('close', () => audioScoreJobs().close())
})
