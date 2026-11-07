import { ref, watch } from 'vue'

/** 明暗主题 */
const theme = ref<'dark' | 'light'>(
  (localStorage.getItem('wt-theme') as 'dark' | 'light') ?? 'dark',
)

export function useTheme() {
  const apply = () => {
    document.documentElement.dataset.theme = theme.value
  }
  watch(theme, () => {
    localStorage.setItem('wt-theme', theme.value)
    apply()
  })
  apply()
  return {
    theme,
    toggle: () => {
      theme.value = theme.value === 'dark' ? 'light' : 'dark'
    },
  }
}
