import type { NormalizedKey } from '../schemas/chart'

export type SelectedMode = 'major' | 'minor'

export type NormalizeKeyInput = {
  originalKey: string | null
  selectedMode: SelectedMode
}

export type NormalizedKeyInfo = {
  normalizedKey: NormalizedKey
  displayOriginalKey: string | null
  transpositionHint: string
}

export function normalizeKeySelection(input: NormalizeKeyInput): NormalizedKeyInfo {
  const normalizedKey = input.selectedMode === 'minor' ? 'Am' : 'C'
  const displayOriginalKey = input.originalKey?.trim() || null

  return {
    normalizedKey,
    displayOriginalKey,
    transpositionHint: buildTranspositionHint(displayOriginalKey, normalizedKey),
  }
}

function buildTranspositionHint(originalKey: string | null, normalizedKey: NormalizedKey): string {
  if (!originalKey) {
    return `Score is written in ${normalizedKey}. Set the original key if needed.`
  }

  return `Original key: ${originalKey}. Score key: ${normalizedKey}.`
}
