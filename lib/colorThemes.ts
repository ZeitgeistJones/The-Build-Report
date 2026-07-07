export type ColorThemeId =
  | 'light'
  | 'light-lavender'
  | 'light-ink'
  | 'light-90s'
  | 'teal'
  | 'lime'
  | 'warm'
  | 'true-dark'

export const COLOR_THEME_STORAGE_KEY = 'build-report-color-theme'
export const CUSTOM_THEME_STORAGE_KEY = 'build-report-custom-theme'

export type CustomThemeVars = {
  bg: string
  accent: string
  base: 'light' | 'dark'
}

/** Parse a hex color to [r, g, b] 0–255. */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Shift lightness of a hex color by a delta (-255 to 255). */
function shiftLightness(hex: string, delta: number): string {
  const [r, g, b] = hexToRgb(hex)
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v + delta)))
  return '#' + [clamp(r), clamp(g), clamp(b)].map(v => v.toString(16).padStart(2, '0')).join('')
}

/** Derive full CSS variable map from CustomThemeVars. */
export function deriveCustomVars(vars: CustomThemeVars): Record<string, string> {
  const { bg, accent, base } = vars
  const isDark = base === 'dark'
  const step = isDark ? -10 : 10
  const [ar, ag, ab] = hexToRgb(accent)

  return {
    '--bg': bg,
    '--surface-1': shiftLightness(bg, step),
    '--surface-2': shiftLightness(bg, step * 0.6),
    '--surface-3': shiftLightness(bg, step * 0.3),
    '--border': shiftLightness(bg, step * 2.2),
    '--border-strong': isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)',
    '--text-primary': isDark ? '#F0F0F0' : '#111111',
    '--text-secondary': isDark ? '#B0B0B0' : '#333333',
    '--text-muted': isDark ? '#707070' : '#666666',
    '--accent': accent,
    '--accent-dim': `rgba(${ar},${ag},${ab},0.12)`,
    '--accent-border': `rgba(${ar},${ag},${ab},0.3)`,
  }
}

/** Write custom vars as inline style on the html element. */
export function applyCustomTheme(vars: CustomThemeVars): void {
  const el = document.documentElement
  el.removeAttribute('data-color-theme')
  const derived = deriveCustomVars(vars)
  const style = Object.entries(derived).map(([k, v]) => `${k}:${v}`).join(';')
  el.setAttribute('style', style)
}

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
        id: 'light-90s',
        label: 'Pressroom',
        hint: '90s metro daily',
        swatchBg: '#FAFAFA',
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
  'light-sage': 'light',
}

export function resolveColorThemeId(value: string | null | undefined): ColorThemeId {
  if (value && isColorThemeId(value)) return value
  if (value && value in LEGACY_THEME_MAP) return LEGACY_THEME_MAP[value]
  return 'light'
}

export function getColorThemeMeta(id: ColorThemeId): ColorThemeMeta {
  return COLOR_THEMES.find(t => t.id === id) ?? COLOR_THEMES[0]
}
