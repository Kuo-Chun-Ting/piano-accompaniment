import { z } from 'zod'
import {
  ConfirmedChartSchema,
  ExtractedChartSchema,
  UploadedImageSchema,
} from '../schemas/chart'

const ChartWorkspaceSnapshotSchema = z.object({
  uploadedImages: z.array(UploadedImageSchema),
  extractedChart: ExtractedChartSchema.nullable(),
  confirmedChart: ConfirmedChartSchema.nullable(),
})

export type ChartWorkspaceSnapshot = z.infer<typeof ChartWorkspaceSnapshotSchema>

export function serializeChartWorkspaceSnapshot(snapshot: ChartWorkspaceSnapshot): string {
  return JSON.stringify(ChartWorkspaceSnapshotSchema.parse(snapshot))
}

export function persistChartWorkspaceSnapshot(
  storage: Pick<Storage, 'removeItem' | 'setItem'>,
  storageKey: string,
  snapshot: ChartWorkspaceSnapshot,
): void {
  if (isWorkspaceEmpty(snapshot)) {
    storage.removeItem(storageKey)
    return
  }

  storage.setItem(storageKey, serializeChartWorkspaceSnapshot(snapshot))
}

export function parseChartWorkspaceSnapshot(rawValue: string | null): ChartWorkspaceSnapshot | null {
  if (!rawValue) {
    return null
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown
    const snapshot = ChartWorkspaceSnapshotSchema.safeParse(parsed)
    return snapshot.success ? snapshot.data : null
  } catch {
    return null
  }
}

function isWorkspaceEmpty(snapshot: ChartWorkspaceSnapshot): boolean {
  return snapshot.uploadedImages.length === 0
    && snapshot.extractedChart === null
    && snapshot.confirmedChart === null
}
