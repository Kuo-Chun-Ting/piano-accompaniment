export default defineNuxtConfig({
  compatibilityDate: '2026-07-18',
  buildDir: process.env.NUXT_BUILD_DIR || '.nuxt',
  devtools: { enabled: true },
  vite: { optimizeDeps: { include: ['vexflow', 'zod'] } },
  runtimeConfig: {
    openaiApiKey: process.env.NUXT_OPENAI_API_KEY || '',
    logModelOutput: process.env.NUXT_LOG_MODEL_OUTPUT === 'true',
    public: {},
  },
  typescript: {
    strict: true,
  },
})
