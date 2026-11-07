import { ref } from 'vue'

export type ModelState = 'idle' | 'loading' | 'ready' | 'error'

export interface ModelProgress {
  status: string
  progress: number
  file?: string
}

/**
 * 重模型 / 编解码器加载（OCR、AI 推理、ffmpeg、HEIC 等）。
 * 首次使用需下载，之后浏览器缓存、离线可用。
 */
export function useModel(name: string) {
  const state = ref<ModelState>('idle')
  const progress = ref<ModelProgress>({ status: '', progress: 0 })
  const error = ref('')

  const begin = () => {
    state.value = 'loading'
    error.value = ''
    progress.value = { status: `准备加载 ${name}…`, progress: 0 }
  }
  const setProgress = (p: Partial<ModelProgress>) => {
    progress.value = { ...progress.value, ...p }
  }
  const done = () => {
    state.value = 'ready'
  }
  const fail = (msg: string) => {
    state.value = 'error'
    error.value = msg
  }

  return { name, state, progress, error, begin, setProgress, done, fail }
}
