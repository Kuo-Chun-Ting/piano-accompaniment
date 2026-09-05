import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer, type Server, type ServerResponse } from 'node:http'
import { extname, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

export interface AudioScoreServerOptions {
  host: string
  port: number
  rootDirectory: string
}

export interface RunningAudioScoreServer {
  origin: string
  close: () => Promise<void>
}

interface ByteRange {
  start: number
  end: number
}

export async function startAudioScoreServer(
  options: AudioScoreServerOptions,
): Promise<RunningAudioScoreServer> {
  const rootDirectory = resolve(options.rootDirectory)
  const server = createServer((request, response) => {
    void serveRequest(rootDirectory, request.url ?? '/', request.headers.range, response)
  })

  await listen(server, options.host, options.port)
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Unable to determine the audio-score server address.')
  }

  return {
    origin: `http://${options.host}:${address.port}`,
    close: () => close(server),
  }
}

async function serveRequest(
  rootDirectory: string,
  requestUrl: string,
  rangeHeader: string | undefined,
  response: ServerResponse,
): Promise<void> {
  try {
    const filePath = await resolveFilePath(rootDirectory, requestUrl)
    const fileStats = await stat(filePath)
    const range = parseRange(rangeHeader, fileStats.size)

    if (rangeHeader && !range) {
      response.writeHead(416, { 'Content-Range': `bytes */${fileStats.size}` })
      response.end()
      return
    }

    sendFile(response, filePath, fileStats.size, range)
  }
  catch {
    response.writeHead(404)
    response.end('Not found')
  }
}

async function resolveFilePath(rootDirectory: string, requestUrl: string): Promise<string> {
  const pathname = decodeURIComponent(new URL(requestUrl, 'http://localhost').pathname)
  const requestedPath = resolve(rootDirectory, `.${pathname}`)
  if (requestedPath !== rootDirectory && !requestedPath.startsWith(`${rootDirectory}${sep}`)) {
    throw new Error('Path is outside the project directory.')
  }

  const requestedStats = await stat(requestedPath)
  return requestedStats.isDirectory() ? resolve(requestedPath, 'index.html') : requestedPath
}

function sendFile(
  response: ServerResponse,
  filePath: string,
  fileSize: number,
  range?: ByteRange,
): void {
  const start = range?.start ?? 0
  const end = range?.end ?? fileSize - 1
  const headers: Record<string, string | number> = {
    'Accept-Ranges': 'bytes',
    'Content-Length': Math.max(0, end - start + 1),
    'Content-Type': contentType(filePath),
  }

  if (range) {
    headers['Content-Range'] = `bytes ${start}-${end}/${fileSize}`
  }

  response.writeHead(range ? 206 : 200, headers)
  createReadStream(filePath, { start, end }).pipe(response)
}

function parseRange(rangeHeader: string | undefined, fileSize: number): ByteRange | undefined {
  if (!rangeHeader) return undefined

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim())
  if (!match || fileSize === 0) return undefined

  const [, rawStart, rawEnd] = match
  if (!rawStart && !rawEnd) return undefined

  const start = rawStart ? Number(rawStart) : Math.max(0, fileSize - Number(rawEnd))
  const end = rawEnd && rawStart ? Math.min(Number(rawEnd), fileSize - 1) : fileSize - 1
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= fileSize) {
    return undefined
  }

  return { start, end }
}

function contentType(filePath: string): string {
  const types: Record<string, string> = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.mid': 'audio/midi',
    '.mp3': 'audio/mpeg',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
  }
  return types[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

function listen(server: Server, host: string, port: number): Promise<void> {
  return new Promise((resolveListen, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => {
      server.off('error', reject)
      resolveListen()
    })
  })
}

function close(server: Server): Promise<void> {
  return new Promise((resolveClose, reject) => {
    server.close(error => error ? reject(error) : resolveClose())
  })
}

async function run(): Promise<void> {
  const server = await startAudioScoreServer({
    host: '127.0.0.1',
    port: 3200,
    rootDirectory: process.cwd(),
  })
  console.log(`Audio-score server: ${server.origin}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void run()
}
