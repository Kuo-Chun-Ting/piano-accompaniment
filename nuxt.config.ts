export default defineNuxtConfig({
  compatibilityDate: '2026-07-18',
  buildDir: process.env.NUXT_BUILD_DIR || '.nuxt',
  devtools: { enabled: true },
  vite: { optimizeDeps: { include: ['vexflow', 'zod'] } },
  typescript: {
    strict: true,
  },
})
