import { ref } from 'vue'

export interface Toast {
  id: number
  type: 'info' | 'ok' | 'warn' | 'err'
  text: string
}

const toasts = ref<Toast[]>([])
let seq = 0

export function useToast() {
  const push = (text: string, type: Toast['type'] = 'info', duration = 2800) => {
    const id = ++seq
    toasts.value.push({ id, type, text })
    setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id)
    }, duration)
  }
  return {
    toasts,
    toast: push,
    ok: (t: string) => push(t, 'ok'),
    err: (t: string) => push(t, 'err', 4200),
    warn: (t: string) => push(t, 'warn', 3600),
  }
}
