import { join } from 'node:path'

export type RequiredModelArtifact = {
  label: string
  path: string
  kind: 'file' | 'directory'
}

export function getRequiredModelArtifacts(modelsDirectory: string): RequiredModelArtifact[] {
  return [
    {
      label: 'BS-RoFormer checkpoint',
      path: join(
        modelsDirectory,
        'roformer-model-bs-roformer-sw-by-jarredou',
        'BS-Rofo-SW-Fixed.ckpt',
      ),
      kind: 'file',
    },
    {
      label: 'BS-RoFormer configuration',
      path: join(
        modelsDirectory,
        'roformer-model-bs-roformer-sw-by-jarredou',
        'BS-Rofo-SW-Fixed.yaml',
      ),
      kind: 'file',
    },
    {
      label: 'All-In-One model cache',
      path: join(modelsDirectory, 'huggingface', 'hub', 'models--taejunkim--allinone'),
      kind: 'directory',
    },
    {
      label: 'All-In-One source separation checkpoint',
      path: join(modelsDirectory, 'torch', 'hub', 'checkpoints', '955717e8-8726e21a.th'),
      kind: 'file',
    },
  ]
}
