import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/component/**/*.test.ts'],
  },
})
