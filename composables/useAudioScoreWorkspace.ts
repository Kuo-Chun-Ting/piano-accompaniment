import { MAX_AUDIO_UPLOAD_BYTES, type AudioScoreJob } from '~/shared/audio-transcription/job'

const STORAGE_KEY = 'audio-score-job'

export function useAudioScoreWorkspace() {
  const file = shallowRef<File | null>(null)
  const job = shallowRef<AudioScoreJob | null>(null)
  const error = ref('')
  const uploading = ref(false)
  const reconnecting = ref(false)
  const cancelling = ref(false)
  const busy = computed(() => cancelling.value || uploading.value || job.value?.status === 'running' || job.value?.status === 'uploading')
  let timer: ReturnType<typeof setTimeout> | undefined
  let request: AbortController | undefined
  let disposed = false

  function remember(id?: string): void {
    try {
      if (id) sessionStorage.setItem(STORAGE_KEY, id)
      else sessionStorage.removeItem(STORAGE_KEY)
    } catch { /* Storage may be unavailable in private browsing. */ }
  }

  function selectFile(value: File | undefined): void {
    if (busy.value || !value) return
    if (!value.name.toLowerCase().endsWith('.wav')) {
      error.value = 'Choose a WAV file.'
      return
    }
    if (value.size === 0 || value.size > MAX_AUDIO_UPLOAD_BYTES) {
      error.value = 'Choose a non-empty WAV file up to 100 MB.'
      return
    }
    reset()
    file.value = value
  }

  async function poll(id: string): Promise<void> {
    clearTimeout(timer)
    request?.abort()
    request = new AbortController()
    const signal = request.signal
    try {
      const next = await $fetch<AudioScoreJob>(`/api/audio-scores/${id}`, { signal })
      if (disposed || signal.aborted) return
      job.value = next
      error.value = next.error ?? ''
      reconnecting.value = false
      if (next.status === 'running' || next.status === 'uploading') timer = setTimeout(() => void poll(id), 1000)
      else cancelling.value = false
    } catch (cause) {
      if (disposed || signal.aborted) return
      cancelling.value = false
      error.value = requestError(cause, 'Connection lost. Please reconnect.')
      if ((cause as { statusCode?: number })?.statusCode === 404) {
        job.value = null
        remember()
        reconnecting.value = false
      } else reconnecting.value = true
    }
  }

  async function start(): Promise<void> {
    if (!file.value || busy.value) return
    error.value = ''
    uploading.value = true
    request = new AbortController()
    try {
      const next = await $fetch<AudioScoreJob>('/api/audio-scores', {
        method: 'POST', body: file.value, signal: request.signal,
        headers: { 'Content-Type': 'audio/wav', 'X-Audio-Filename': encodeURIComponent(file.value.name) },
      })
      remember(next.id)
      if (disposed) return
      job.value = next
      void poll(next.id)
    } catch (cause) {
      if (!disposed) error.value = requestError(cause, 'Upload failed. Please retry.')
    } finally { uploading.value = false }
  }

  async function cancel(): Promise<void> {
    if (!job.value || cancelling.value) return
    cancelling.value = true
    clearTimeout(timer)
    request?.abort()
    const id = job.value.id
    try {
      await $fetch(`/api/audio-scores/${id}`, { method: 'DELETE' })
      if (!disposed) await poll(id)
    } catch (cause) {
      cancelling.value = false
      if (!disposed) {
        error.value = requestError(cause, 'Could not cancel. Please retry.')
        reconnecting.value = true
      }
    }
  }

  function reset(): void {
    if (busy.value) return
    clearTimeout(timer)
    request?.abort()
    remember()
    job.value = null
    file.value = null
    error.value = ''
    reconnecting.value = false
  }

  onMounted(() => {
    try {
      const id = sessionStorage.getItem(STORAGE_KEY)
      if (id) {
        job.value = { id, title: '', status: 'running', stage: 'starting' }
        void poll(id)
      }
    } catch { /* Starting a new upload does not require browser storage. */ }
  })
  onBeforeUnmount(() => {
    disposed = true
    clearTimeout(timer)
    // Accepted jobs continue on the server and can be restored after refresh.
    request?.abort()
  })

  return { file, job, error, busy, uploading, reconnecting, cancelling, selectFile, start, cancel, reset,
    reconnect: () => job.value && poll(job.value.id) }
}

function requestError(cause: unknown, fallback: string): string {
  const data = (cause as { data?: { message?: unknown } })?.data
  return typeof data?.message === 'string' ? data.message : fallback
}
