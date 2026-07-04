export type ColorThemeId = 'teal' | 'lime' | 'warm' | 'slate' | 'light'

export const COLOR_THEME_STORAGE_KEY = 'build-report-color-theme'

export const COLOR_THEMES: { id: ColorThemeId; label: string; hint: string }[] = [
  { id: 'teal', label: 'Teal', hint: 'Default — cool dark' },
  { id: 'lime', label: 'Lime', hint: 'Original accent' },
  { id: 'warm', label: 'Warm', hint: 'Sand & amber' },
  { id: 'slate', label: 'Slate', hint: 'Neutral blue-gray' },
  { id: 'light', label: 'Light', hint: 'Light background' },
]

export function isColorThemeId(value: string): value is ColorThemeId {
  return COLOR_THEMES.some(t => t.id === value)
}
