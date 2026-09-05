import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import type { ServerResponse } from 'node:http'
import { pipeline } from 'node:stream/promises'

interface ByteRange { start: number; end: number }

export async function sendRangeFile(
  response: ServerResponse, filePath: string, contentType: string,
  rangeHeader?: string, head = false,
): Promise<void> {
  const { size } = await stat(filePath)
  const range = parseRange(rangeHeader, size)
  if (rangeHeader && !range) {
    response.writeHead(416, { 'Content-Range': `bytes */${size}` })
    response.end()
    return
  }
  const headers: Record<string, string | number> = {
    'Accept-Ranges': 'bytes', 'Content-Type': contentType,
    'Content-Length': range ? range.end - range.start + 1 : size,
  }
  if (range) headers['Content-Range'] = `bytes ${range.start}-${range.end}/${size}`
  response.writeHead(range ? 206 : 200, headers)
  if (head || size === 0) { response.end(); return }
  try {
    await pipeline(createReadStream(filePath, range), response)
  } catch (error) {
    // Seeking may close the previous request. Never write a second set of headers.
    if (!response.destroyed) response.destroy(error as Error)
  }
}

function parseRange(header: string | undefined, size: number): ByteRange | undefined {
  if (!header || size === 0) return undefined
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match) return undefined
  const [, rawStart, rawEnd] = match
  if (!rawStart && !rawEnd) return undefined
  const start = rawStart ? Number(rawStart) : Math.max(0, size - Number(rawEnd))
  const end = rawEnd && rawStart ? Math.min(Number(rawEnd), size - 1) : size - 1
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= size) return undefined
  return { start, end }
}
