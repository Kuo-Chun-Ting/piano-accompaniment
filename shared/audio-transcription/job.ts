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

export const AUDIO_SCORE_PHASES = [
  'Uploading audio…', 'Separating piano…', 'Recognizing notes…',
  'Recognizing lyrics…', 'Creating score…',
] as const

const STAGE_PHASES: Record<string, number> = {
  uploading: 0,
  starting: 1,
  'check-environment': 1,
  'normalize-audio': 1,
  'separate-piano': 1,
  'transcribe-midi': 2,
  'analyze-structure': 2,
  'export-midi-notes': 2,
  'export-pitch-energy': 2,
  'transcribe-lyrics': 3,
  'build-viewer': 4,
}

export function audioScorePhase(stage: string): number {
  return STAGE_PHASES[stage] ?? -1
}

export function audioScoreStageLabel(stage: string): string {
  if (['starting', 'check-environment', 'normalize-audio'].includes(stage)) return 'Preparing audio…'
  return AUDIO_SCORE_PHASES[audioScorePhase(stage)] ?? 'Processing audio…'
}
