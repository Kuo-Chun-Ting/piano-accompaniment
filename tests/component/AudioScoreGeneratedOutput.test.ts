// @vitest-environment happy-dom

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { beforeAll, expect, test, vi } from 'vitest'
import PianoScoreSystem from '../../components/PianoScoreSystem.vue'
import { buildScoreSystems } from '../../shared/ui/scoreSystems'

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class {
    constructor(private readonly callback: ResizeObserverCallback) {}
    observe(): void { this.callback([], this as unknown as ResizeObserver) }
    disconnect(): void {}
  })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => 1200,
  })
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})
})

for (const name of ['安靜', '楓']) {
  const scorePath = resolve(`.audio-score/${name}/score.json`)

  test.skipIf(!existsSync(scorePath))(`test_AudioScoreGeneratedOutput_when_${name}_is_generated_then_renders_every_system`, async () => {
    const score = JSON.parse(readFileSync(scorePath, 'utf8'))
    const systems = buildScoreSystems(score.version.measures)

    for (const system of systems) {
      const visibleEventCount = system.measures.flatMap(measure => measure.staves)
        .flatMap(staff => staff.voices)
        .flatMap(voice => voice.events)
        .filter(event => !event.isSpacer)
        .length
      const wrapper = mount(PianoScoreSystem, {
        props: {
          system,
          keySignature: score.version.keySignature,
          pedalIntervals: score.version.pedalIntervals,
        },
      })
      await nextTick()
      expect(wrapper.findAll('svg .vf-stave')).toHaveLength(system.measures.length * 2)
      expect(wrapper.findAll('svg .vf-stavenote')).toHaveLength(visibleEventCount)
      wrapper.unmount()
    }
  })
}
