export const MIN_PANE_PERCENT = 28
export const MAX_PANE_PERCENT = 72
export const MIN_IMAGE_ZOOM = 0.5
export const MAX_IMAGE_ZOOM = 2

export function clampPanePercent(value: number): number {
  return Math.min(MAX_PANE_PERCENT, Math.max(MIN_PANE_PERCENT, value))
}

export function adjustImageZoom(currentZoom: number, delta: number): number {
  return Math.min(MAX_IMAGE_ZOOM, Math.max(MIN_IMAGE_ZOOM, currentZoom + delta))
}
