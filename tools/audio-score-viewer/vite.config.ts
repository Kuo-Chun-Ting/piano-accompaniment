import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { escapeHtmlText } from './html'
import { parseViewerData } from './viewerData'

const viewerDirectory = dirname(fileURLToPath(import.meta.url))
const projectDirectory = resolve(viewerDirectory, '../..')

export default defineConfig(() => {
  const dataPath = requiredEnvironmentPath('AUDIO_SCORE_DATA')
  const outputDirectory = requiredEnvironmentPath('AUDIO_SCORE_VIEWER_OUT')
  const data = parseViewerData(JSON.parse(readFileSync(dataPath, 'utf8')))

  return {
    root: viewerDirectory,
    base: './',
    resolve: {
      alias: {
        '~': projectDirectory,
        '@': projectDirectory,
      },
    },
    define: {
      __AUDIO_SCORE_DATA__: JSON.stringify(data),
    },
    plugins: [
      {
        name: 'audio-score-document-title',
        transformIndexHtml(html) {
          return html.replace(
            '<title>Piano transcription</title>',
            `<title>${escapeHtmlText(data.title)}</title>`,
          )
        },
      },
      vue(),
      AutoImport({
        imports: ['vue'],
        dirs: [resolve(projectDirectory, 'composables')],
        dts: false,
      }),
      Components({
        dirs: [viewerDirectory, resolve(projectDirectory, 'components')],
        dts: false,
      }),
      viteSingleFile(),
    ],
    build: {
      outDir: outputDirectory,
      emptyOutDir: false,
      cssCodeSplit: false,
    },
  }
})

function requiredEnvironmentPath(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} must contain an absolute path`)
  }
  return resolve(value)
}
