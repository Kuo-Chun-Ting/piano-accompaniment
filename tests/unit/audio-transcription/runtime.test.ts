import { expect, test } from 'vitest'
import { getRequiredModelArtifacts } from '../../../shared/audio-transcription/runtime'

test('test_getRequiredModelArtifacts_when_runtime_is_fixed_then_keeps_every_model_inside_it', () => {
  // Act
  const artifacts = getRequiredModelArtifacts('/runtime/models')

  // Assert
  expect(artifacts).toEqual([
    {
      label: 'BS-RoFormer checkpoint',
      path: '/runtime/models/roformer-model-bs-roformer-sw-by-jarredou/BS-Rofo-SW-Fixed.ckpt',
      kind: 'file',
    },
    {
      label: 'BS-RoFormer configuration',
      path: '/runtime/models/roformer-model-bs-roformer-sw-by-jarredou/BS-Rofo-SW-Fixed.yaml',
      kind: 'file',
    },
    {
      label: 'All-In-One model cache',
      path: '/runtime/models/huggingface/hub/models--taejunkim--allinone',
      kind: 'directory',
    },
    {
      label: 'All-In-One source separation checkpoint',
      path: '/runtime/models/torch/hub/checkpoints/955717e8-8726e21a.th',
      kind: 'file',
    },
  ])
})
