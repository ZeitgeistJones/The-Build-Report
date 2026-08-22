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
export const DEFAULT_COLOR_THEME: ColorThemeId = 'light-90s'

const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

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
        id: 'light-90s',
        label: 'Pressroom',
        hint: '90s metro daily',
        swatchBg: '#FAFAFA',
        swatchAccent: '#8B2323',
      },
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
  return DEFAULT_COLOR_THEME
}

export function getColorThemeMeta(id: ColorThemeId): ColorThemeMeta {
  return COLOR_THEMES.find(t => t.id === id) ?? COLOR_THEMES[0]
}

export function parseCustomThemeVars(raw: string | null | undefined): CustomThemeVars | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<CustomThemeVars>
    if (typeof value.bg !== 'string' || typeof value.accent !== 'string') return null
    if (value.base !== 'light' && value.base !== 'dark') return null
    return { bg: value.bg, accent: value.accent, base: value.base }
  } catch {
    return null
  }
}

function writeCookie(name: string, value: string): void {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${THEME_COOKIE_MAX_AGE};samesite=lax`
}

function clearCookie(name: string): void {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=;path=/;max-age=0;samesite=lax`
}

export function readThemeCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const prefix = `${name}=`
  const parts = document.cookie.split(';')
  for (const part of parts) {
    const row = part.trim()
    if (!row.startsWith(prefix)) continue
    try {
      return decodeURIComponent(row.slice(prefix.length))
    } catch {
      return row.slice(prefix.length)
    }
  }
  return null
}

function readLocal(name: string): string | null {
  try {
    return localStorage.getItem(name)
  } catch (err) {
    console.error('[theme] failed to read saved theme', err)
    return null
  }
}

function writeLocal(name: string, value: string): void {
  try {
    localStorage.setItem(name, value)
  } catch (err) {
    console.error('[theme] failed to save theme', err)
  }
}

function removeLocal(name: string): void {
  try {
    localStorage.removeItem(name)
  } catch (err) {
    console.error('[theme] failed to clear theme', err)
  }
}

/** Last saved preset or custom theme — localStorage first, cookie as backup. */
export function readStoredColorTheme(): {
  theme: ColorThemeId
  customVars: CustomThemeVars | null
  hadStored: boolean
} {
  const customVars = parseCustomThemeVars(
    readLocal(CUSTOM_THEME_STORAGE_KEY) ?? readThemeCookie(CUSTOM_THEME_STORAGE_KEY),
  )
  if (customVars) {
    return { theme: DEFAULT_COLOR_THEME, customVars, hadStored: true }
  }
  const stored = readLocal(COLOR_THEME_STORAGE_KEY) ?? readThemeCookie(COLOR_THEME_STORAGE_KEY)
  return { theme: resolveColorThemeId(stored), customVars: null, hadStored: Boolean(stored) }
}

export function persistPresetTheme(id: ColorThemeId): void {
  writeLocal(COLOR_THEME_STORAGE_KEY, id)
  removeLocal(CUSTOM_THEME_STORAGE_KEY)
  writeCookie(COLOR_THEME_STORAGE_KEY, id)
  clearCookie(CUSTOM_THEME_STORAGE_KEY)
}

export function persistCustomTheme(vars: CustomThemeVars): void {
  const raw = JSON.stringify(vars)
  writeLocal(CUSTOM_THEME_STORAGE_KEY, raw)
  writeCookie(CUSTOM_THEME_STORAGE_KEY, raw)
}

export function clearPersistedCustomTheme(): void {
  removeLocal(CUSTOM_THEME_STORAGE_KEY)
  clearCookie(CUSTOM_THEME_STORAGE_KEY)
}
