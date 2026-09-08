import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const configDirectory = dirname(fileURLToPath(import.meta.url))
const projectDirectory = resolve(configDirectory, '../..')

export default defineConfig({
  build: {
    ssr: resolve(projectDirectory, 'scripts/audio-score.ts'),
    outDir: resolve(projectDirectory, '.output'),
    emptyOutDir: false,
    target: 'node24',
    rollupOptions: {
      output: {
        entryFileNames: 'audio-score.mjs',
      },
    },
  },
  ssr: {
    noExternal: true,
  },
})
