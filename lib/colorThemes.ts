export type ColorThemeId =
  | 'light'
  | 'light-lavender'
  | 'light-ink'
  | 'light-sage'
  | 'light-90s'
  | 'teal'
  | 'lime'
  | 'warm'
  | 'true-dark'

export const COLOR_THEME_STORAGE_KEY = 'build-report-color-theme'

export type ColorThemeMeta = {
  id: ColorThemeId
  label: string
  hint: string
  swatchBg: string
  swatchAccent: string
}

export const COLOR_THEME_GROUPS: { label: string; themes: ColorThemeMeta[] }[] = [
  {
    label: 'Light',
    themes: [
      {
        id: 'light',
        label: 'Frost',
        hint: 'Cool gray',
        swatchBg: '#F4F6F8',
        swatchAccent: '#3D9A88',
      },
      {
        id: 'light-lavender',
        label: 'Lavender',
        hint: 'Soft indigo desk',
        swatchBg: '#F1EFF6',
        swatchAccent: '#6A4FB0',
      },
      {
        id: 'light-ink',
        label: 'Ink',
        hint: 'Crisp white + navy',
        swatchBg: '#FFFFFF',
        swatchAccent: '#2563EB',
      },
      {
        id: 'light-sage',
        label: 'Sage',
        hint: 'Soft green report desk',
        swatchBg: '#F5F7F4',
        swatchAccent: '#3D7A52',
      },
      {
        id: 'light-90s',
        label: 'Pressroom',
        hint: '90s metro daily',
        swatchBg: '#D9D6CC',
        swatchAccent: '#8B2323',
      },
    ],
  },
  {
    label: 'Dark',
    themes: [
      {
        id: 'teal',
        label: 'Teal',
        hint: 'Cool dark',
        swatchBg: '#0B0E10',
        swatchAccent: '#5FB3A1',
      },
      {
        id: 'true-dark',
        label: 'True dark',
        hint: 'Pure black & white',
        swatchBg: '#000000',
        swatchAccent: '#FFFFFF',
      },
      {
        id: 'lime',
        label: 'Lime',
        hint: 'Neon accent',
        swatchBg: '#0E0E0E',
        swatchAccent: '#C8F060',
      },
      {
        id: 'warm',
        label: 'Warm',
        hint: 'Sand & amber',
        swatchBg: '#100E0C',
        swatchAccent: '#C4A882',
      },
    ],
  },
]

export const COLOR_THEMES: ColorThemeMeta[] = COLOR_THEME_GROUPS.flatMap(g => g.themes)

const THEME_IDS = new Set(COLOR_THEMES.map(t => t.id))

export function isColorThemeId(value: string): value is ColorThemeId {
  return THEME_IDS.has(value as ColorThemeId)
}

/** Maps removed themes to a current replacement. */
const LEGACY_THEME_MAP: Record<string, ColorThemeId> = {
  slate: 'teal',
  'light-paper': 'light-lavender',
  'light-newsprint': 'light-90s',
  'light-broadsheet': 'light-90s',
}

export function resolveColorThemeId(value: string | null | undefined): ColorThemeId {
  if (value && isColorThemeId(value)) return value
  if (value && value in LEGACY_THEME_MAP) return LEGACY_THEME_MAP[value]
  return 'light'
}

export function getColorThemeMeta(id: ColorThemeId): ColorThemeMeta {
  return COLOR_THEMES.find(t => t.id === id) ?? COLOR_THEMES[0]
}
