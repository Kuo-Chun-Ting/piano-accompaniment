import { stat } from 'node:fs/promises'
import { createServer, type Server, type ServerResponse } from 'node:http'
import { extname, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { sendRangeFile } from '../server/services/rangeFile'

export interface AudioScoreServerOptions {
  host: string
  port: number
  rootDirectory: string
}

export interface RunningAudioScoreServer {
  origin: string
  close: () => Promise<void>
}

export async function startAudioScoreServer(
  options: AudioScoreServerOptions,
): Promise<RunningAudioScoreServer> {
  const rootDirectory = resolve(options.rootDirectory)
  const server = createServer((request, response) => {
    void serveRequest(rootDirectory, request.url ?? '/', request.headers.range, response, request.method === 'HEAD')
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
  head: boolean,
): Promise<void> {
  try {
    const filePath = await resolveFilePath(rootDirectory, requestUrl)
    await sendRangeFile(response, filePath, contentType(filePath), rangeHeader, head)
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
