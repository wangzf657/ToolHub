<script setup lang="ts">
import { computed, ref } from 'vue'
import { UploadCloud, File as FileIcon, X, GripVertical, FilePlus2 } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

const props = withDefaults(
  defineProps<{
    accept?: string
    multiple?: boolean
    maxFiles?: number
    /** 标签文案 */
    label?: string
    hint?: string
  }>(),
  { multiple: true, label: '拖放文件到此处，或点击选择', hint: '在你的设备上处理 —— 从不上传' },
)

const emit = defineEmits<{ files: [files: File[]] }>()
const dragging = ref(false)
const files = ref<File[]>([])
const toast = useToast()

const addFiles = (list: FileList | File[]) => {
  const arr = Array.from(list)
  if (!props.multiple) {
    files.value = arr.slice(0, 1)
  } else {
    const max = props.maxFiles ?? 50
    files.value = [...files.value, ...arr].slice(0, max)
  }
  emit('files', [...files.value])
}

const onDrop = (e: DragEvent) => {
  dragging.value = false
  const dt = e.dataTransfer
  if (dt?.files?.length) addFiles(dt.files)
}

const onInput = (e: Event) => {
  const input = e.target as HTMLInputElement
  if (input.files?.length) addFiles(input.files)
  input.value = ''
}

const removeAt = (i: number) => {
  files.value.splice(i, 1)
  emit('files', [...files.value])
}

const clear = () => {
  files.value = []
  emit('files', [])
}

/** 重排（简单上下移） */
const move = (i: number, dir: -1 | 1) => {
  const j = i + dir
  if (j < 0 || j >= files.value.length) return
  const arr = [...files.value]
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
  files.value = arr
  emit('files', [...files.value])
}

const sizeLabel = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`)

const acceptAttr = computed(() => props.accept)
defineExpose({ files, clear, addFiles })
void toast
</script>

<template>
  <div>
    <div
      class="drop-zone"
      :class="{ dragging }"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
      @click="($refs.fileInput as HTMLInputElement).click()"
    >
      <input
        ref="fileInput"
        type="file"
        class="hidden-input"
        :accept="acceptAttr"
        :multiple="multiple"
        @change="onInput"
      />
      <UploadCloud :size="30" class="drop-icon" />
      <p class="drop-label">{{ label }}</p>
      <p class="drop-hint">{{ hint }}</p>
    </div>

    <div v-if="files.length" class="file-list">
      <div v-for="(f, i) in files" :key="`${f.name}-${i}`" class="file-row">
        <GripVertical :size="14" class="grip" />
        <span class="file-idx">{{ i + 1 }}</span>
        <FileIcon :size="16" class="file-icon" />
        <span class="file-name" :title="f.name">{{ f.name }}</span>
        <span class="file-size">{{ sizeLabel(f.size) }}</span>
        <span class="row gap4">
          <button v-if="multiple && files.length > 1" class="mini-btn" title="上移" @click="move(i, -1)">↑</button>
          <button v-if="multiple && files.length > 1" class="mini-btn" title="下移" @click="move(i, 1)">↓</button>
          <button class="mini-btn danger" title="移除" @click="removeAt(i)"><X :size="13" /></button>
        </span>
      </div>
      <button class="btn btn-ghost btn-sm mt-1" @click="clear">
        <FilePlus2 :size="14" /> 清空列表
      </button>
    </div>
  </div>
</template>

<style scoped>
.drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 36px 20px;
  border: 1.5px dashed var(--border-strong);
  border-radius: 14px;
  background: color-mix(in srgb, var(--panel-solid) 45%, transparent);
  cursor: pointer;
  transition: all 0.18s ease;
  text-align: center;
}
.drop-zone:hover,
.drop-zone.dragging {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.drop-icon {
  color: var(--accent-text);
}
.drop-label {
  margin: 4px 0 0;
  font-weight: 600;
  font-size: 14.5px;
}
.drop-hint {
  margin: 0;
  font-size: 12.5px;
  color: var(--text-3);
}
.hidden-input {
  display: none;
}
.file-list {
  margin-top: 12px;
  display: grid;
  gap: 6px;
}
.file-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
  font-size: 13px;
}
.grip {
  color: var(--text-3);
  flex: none;
}
.file-idx {
  flex: none;
  min-width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-text);
  font-size: 11px;
  font-weight: 700;
}
.file-icon {
  color: var(--text-3);
  flex: none;
}
.file-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-size {
  flex: none;
  color: var(--text-3);
  font-size: 12px;
}
.gap4 {
  gap: 4px;
}
.mini-btn {
  border: 1px solid var(--border);
  background: none;
  color: var(--text-2);
  border-radius: 7px;
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  cursor: pointer;
  font-size: 12px;
}
.mini-btn:hover {
  border-color: var(--accent);
  color: var(--text);
}
.mini-btn.danger:hover {
  border-color: var(--err);
  color: var(--err);
}
</style>
