import type { ViewerScoreData } from '../../tools/audio-score-viewer/viewerData'

export const MAX_AUDIO_UPLOAD_BYTES = 100 * 1024 * 1024

export interface AudioScoreJob {
  id: string
  title: string
  status: 'uploading' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  stage: string
  error?: string
  result?: ViewerScoreData
}

const STAGE_LABELS: Record<string, string> = {
  uploading: 'Uploading audio…',
  starting: 'Preparing…',
  'check-environment': 'Checking setup…',
  'normalize-audio': 'Reading audio…',
  'separate-piano': 'Separating piano…',
  'transcribe-midi': 'Transcribing notes…',
  'analyze-structure': 'Analyzing beats…',
  'export-midi-notes': 'Processing notes…',
  'export-pitch-energy': 'Analyzing sustain…',
  'transcribe-lyrics': 'Transcribing lyrics…',
  'build-viewer': 'Creating score…',
}

export function audioScoreStageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? 'Transcribing…'
}
