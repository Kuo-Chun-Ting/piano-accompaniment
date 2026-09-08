// @vitest-environment nuxt
import { expect, test } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import StudioPage from '../../pages/index.vue'

test('test_StudioPage_when_opened_then_shows_brand_and_audio_workspace', async () => {
  // Arrange
  sessionStorage.clear()
  // Act
  const wrapper = await mountSuspended(StudioPage, {
    global: { stubs: { AudioScoreWorkspace: { name: 'AudioScoreWorkspace', template: '<section>Audio</section>' } } },
  })
  // Assert
  expect(wrapper.text()).toContain('Piano Accompaniment Studio')
  expect(wrapper.findComponent({ name: 'AudioScoreWorkspace' }).exists()).toBe(true)
  expect(wrapper.find('[aria-label="Workspace view"]').exists()).toBe(false)
  wrapper.unmount()
})
