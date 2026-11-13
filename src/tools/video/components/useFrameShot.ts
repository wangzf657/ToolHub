/**
 * 单帧截取操作复用逻辑（VideoThumbnail 拆分）：
 * 截取只更新预览（不落盘），保存单独落盘（文件名含时刻），逐帧步进与快捷帧定位。
 */
import { ref, type Ref, type ShallowRef } from 'vue'
import { seekTo, captureFrame, type VideoMeta } from '@/lib/videoEngine'
import { canvasToBlob } from '@/lib/imageEngine'
import { saveBlob, baseName } from '@/lib/download'
import { useToast } from '@/composables/useToast'

export function useFrameShot(
  meta: ShallowRef<VideoMeta | null>,
  file: Ref<File | null>,
  time: Ref<number>,
  fmt?: Ref<'image/jpeg' | 'image/png'>,
) {
  const toast = useToast()
  const busy = ref(false)
  const previewUrl = ref('')

  const mime = () => fmt?.value ?? 'image/jpeg'
  const ext = () => (mime() === 'image/png' ? 'png' : 'jpg')

  /** 截取并更新预览区（不落盘；下载走「保存这张」） */
  const grab = async () => {
    if (!meta.value) return
    busy.value = true
    try {
      await seekTo(meta.value, time.value)
      const c = captureFrame(meta.value, time.value)
      previewUrl.value = c.toDataURL(mime())
      toast.ok('已更新预览，点「保存这张」下载')
    } catch (e) {
      toast.err((e as Error).message || '截帧失败')
    } finally {
      busy.value = false
    }
  }

  /** 保存当前时刻帧（文件名含时刻） */
  const saveShot = async () => {
    if (!meta.value || !previewUrl.value) {
      toast.warn('请先截取一帧预览')
      return
    }
    busy.value = true
    try {
      await seekTo(meta.value, time.value)
      const c = captureFrame(meta.value, time.value)
      const blob = await canvasToBlob(c, mime(), 0.92)
      saveBlob(blob, `${baseName(file.value?.name ?? 'video')}-${time.value.toFixed(2)}s.${ext()}`)
      toast.ok('已保存下载')
    } catch (e) {
      toast.err((e as Error).message || '保存失败')
    } finally {
      busy.value = false
    }
  }

  /** 逐帧步进：←/→ 按 1/30s，Shift+方向键按 0.1s */
  const onStep = async (e: KeyboardEvent) => {
    if (!meta.value) return
    const step = e.shiftKey ? 0.1 : 1 / 30
    if (e.key === 'ArrowLeft') time.value = Math.max(0, time.value - step)
    else if (e.key === 'ArrowRight') time.value = Math.min(meta.value.duration, time.value + step)
    else return
    e.preventDefault()
    await grab()
  }

  /** 快捷帧：首帧 / 中间帧 / 末帧 */
  const quickFrame = async (which: 'first' | 'mid' | 'last') => {
    if (!meta.value) return
    const d = meta.value.duration
    time.value = Number((which === 'first' ? 0 : which === 'mid' ? d / 2 : Math.max(0, d - 0.05)).toFixed(2))
    await grab()
  }

  return { busy, previewUrl, grab, saveShot, onStep, quickFrame }
}
