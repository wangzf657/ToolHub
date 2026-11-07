import { ref } from 'vue'

const KEY = 'wt-saved'

function load(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

/** 收藏（星标）工具，全站共享状态 */
const saved = ref<string[]>(load())

function persist() {
  localStorage.setItem(KEY, JSON.stringify(saved.value))
}

export function useSaved() {
  const isSaved = (slug: string) => saved.value.includes(slug)
  const toggle = (slug: string) => {
    if (isSaved(slug)) saved.value = saved.value.filter((s) => s !== slug)
    else saved.value = [slug, ...saved.value]
    persist()
  }
  const remove = (slug: string) => {
    saved.value = saved.value.filter((s) => s !== slug)
    persist()
  }
  return { saved, isSaved, toggle, remove }
}
