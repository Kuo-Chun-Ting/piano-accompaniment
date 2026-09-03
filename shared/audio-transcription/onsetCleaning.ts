import { groupTranscribedNotesByOnset } from './midiToScore'
import {
  evaluateOnsetEvidence,
  type OnsetEvidenceStatus,
  type PitchEnergySamples,
} from './onsetEvidence'
import type { TranscribedNote } from './types'

export type PitchEnergyFile = {
  noiseFloor: number
  pitches: PitchEnergySamples[]
}

export type RejectedOnsetGroup = {
  startSeconds: number
  pitches: number[]
}

export type CleanedTranscription = {
  notes: TranscribedNote[]
  rejectedGroups: RejectedOnsetGroup[]
}

type ExportedPitchEnergyFile = {
  noiseFloor: number
  startSeconds: number
  frameSeconds: number
  pitches: Array<{
    midi: number
    values: number[]
  }>
}

export function parsePitchEnergyFile(value: unknown): PitchEnergyFile {
  const candidate = value as Partial<ExportedPitchEnergyFile>
  const hasValidHeader = isNonNegativeFinite(candidate.noiseFloor)
    && isNonNegativeFinite(candidate.startSeconds)
    && Number.isFinite(candidate.frameSeconds)
    && (candidate.frameSeconds ?? 0) > 0
  const pitches = candidate.pitches
  const hasValidPitches = Array.isArray(pitches)
    && pitches.length > 0
    && pitches.every(pitch => Number.isInteger(pitch.midi)
      && pitch.midi >= 0
      && pitch.midi <= 127
      && Array.isArray(pitch.values)
      && pitch.values.length > 0
      && pitch.values.every(isNonNegativeFinite))
    && new Set(pitches.map(pitch => pitch.midi)).size === pitches.length

  if (!hasValidHeader || !hasValidPitches) {
    throw new Error('Pitch-energy export is invalid')
  }

  const exported = candidate as ExportedPitchEnergyFile
  return {
    noiseFloor: exported.noiseFloor,
    pitches: exported.pitches.map(pitch => ({
      midi: pitch.midi,
      startSeconds: exported.startSeconds,
      frameSeconds: exported.frameSeconds,
      values: pitch.values,
    })),
  }
}

export function cleanTranscribedNotes(
  notes: TranscribedNote[],
  energy: PitchEnergyFile,
): CleanedTranscription {
  const samplesByPitch = new Map(energy.pitches.map(samples => [samples.midi, samples]))
  const confirmedOnsetByPitch = new Map<number, number>()
  const latestNoteByPitch = new Map<number, TranscribedNote>()
  const cleanedNotes: TranscribedNote[] = []
  const rejectedGroups: RejectedOnsetGroup[] = []

  for (const group of groupTranscribedNotesByOnset(notes)) {
    const statuses = group.map(note => classifyCandidate(
      note,
      samplesByPitch.get(note.midi),
      confirmedOnsetByPitch.get(note.midi),
      energy.noiseFloor,
    ))
    const canMerge = group.length > 1
      && statuses.every(status => status === 'rejected')
      && group.every(note => latestNoteByPitch.has(note.midi))

    if (canMerge) {
      mergeIntoPreviousNotes(group, latestNoteByPitch)
      rejectedGroups.push({
        startSeconds: group[0]!.startSeconds,
        pitches: group.map(note => note.midi),
      })
      continue
    }

    group.forEach((note, index) => {
      const retainedNote = { ...note }
      cleanedNotes.push(retainedNote)
      latestNoteByPitch.set(note.midi, retainedNote)
      if (statuses[index] === 'confirmed') {
        confirmedOnsetByPitch.set(note.midi, note.startSeconds)
      }
    })
  }

  return { notes: cleanedNotes, rejectedGroups }
}

function classifyCandidate(
  note: TranscribedNote,
  samples: PitchEnergySamples | undefined,
  previousOnsetSeconds: number | undefined,
  noiseFloor: number,
): OnsetEvidenceStatus {
  if (!samples || previousOnsetSeconds === undefined) {
    return 'confirmed'
  }

  return evaluateOnsetEvidence({
    samples,
    candidateSeconds: note.startSeconds,
    previousOnsetSeconds,
    noiseFloor,
  }).status
}

function mergeIntoPreviousNotes(
  group: TranscribedNote[],
  latestNoteByPitch: Map<number, TranscribedNote>,
): void {
  for (const note of group) {
    const previous = latestNoteByPitch.get(note.midi)!
    previous.endSeconds = Math.max(previous.endSeconds, note.endSeconds)
  }
}

function isNonNegativeFinite(value: unknown): value is number {
  return Number.isFinite(value) && (value as number) >= 0
}
