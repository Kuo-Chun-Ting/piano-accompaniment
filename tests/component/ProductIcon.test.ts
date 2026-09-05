// @vitest-environment nuxt
import { expect, test } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import StudioToolbar from '../../components/StudioToolbar.vue'
import AudioScoreWorkspace from '../../components/AudioScoreWorkspace.vue'
import ProductIcon from '../../components/ProductIcon.vue'

test('test_ProductIcon_when_toolbar_and_upload_render_then_share_icon_source', async () => {
  // Arrange
  sessionStorage.clear()
  const toolbar = await mountSuspended(StudioToolbar, {
    props: { activeView: 'score', chartAvailable: false, scoreAvailable: false },
  })
  const workspace = await mountSuspended(AudioScoreWorkspace)
  try {
    // Act
    const brandIcon = toolbar.findComponent(ProductIcon)
    const uploadIcon = workspace.findComponent(ProductIcon)
    // Assert
    expect(brandIcon.exists()).toBe(true)
    expect(uploadIcon.exists()).toBe(true)
    expect(brandIcon.element.tagName.toLowerCase()).toBe('svg')
    expect(brandIcon.attributes('viewBox')).toBe(uploadIcon.attributes('viewBox'))
    expect(brandIcon.attributes('aria-hidden')).toBe('true')
    expect(uploadIcon.attributes('aria-hidden')).toBe('true')
  } finally {
    toolbar.unmount()
    workspace.unmount()
  }
})
