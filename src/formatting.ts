import type { AnnotationType } from './analysis';

export type FormattingCategory = 'uniqueBeginning' | 'uniqueEnding' | 'frequency1' | 'frequency2' | 'frequency3';
export interface FormattingStyle { color: string; backgroundColor: string; bold: boolean; italic: boolean; underline: boolean; strikethrough: boolean; marker: boolean; }
export interface PresentationConfig { version: '1.0'; preset: 'classic' | 'pastel' | 'high-contrast' | 'minimal' | 'custom'; fontSize: number; lineSpacing: number; verseSpacing: number; categories: Record<FormattingCategory, FormattingStyle>; }

const style = (color: string, backgroundColor = 'transparent', overrides: Partial<FormattingStyle> = {}): FormattingStyle => ({ color, backgroundColor, bold: true, italic: false, underline: false, strikethrough: false, marker: false, ...overrides });

export const builtInPresentationConfig: PresentationConfig = {
  version: '1.0', preset: 'classic', fontSize: 1, lineSpacing: 1.55, verseSpacing: 0.4,
  categories: {
    uniqueBeginning: style('#173f45', 'transparent', { underline: true, marker: true }),
    uniqueEnding: style('#173f45', 'transparent', { underline: true, marker: true }),
    frequency1: style('#2563eb'), frequency2: style('#16834b'), frequency3: style('#c33b32'),
  },
};

export const presentationPresets: Record<Exclude<PresentationConfig['preset'], 'custom'>, PresentationConfig> = {
  classic: builtInPresentationConfig,
  pastel: { ...builtInPresentationConfig, preset: 'pastel', categories: { ...builtInPresentationConfig.categories, frequency1: style('#2457a6', '#e8f0ff'), frequency2: style('#23704a', '#e6f6ec'), frequency3: style('#a33d38', '#fff0ee'), uniqueBeginning: style('#43536b', '#f4f7fb', { underline: true, marker: true }), uniqueEnding: style('#43536b', '#f4f7fb', { underline: true, marker: true }) } },
  'high-contrast': { ...builtInPresentationConfig, preset: 'high-contrast', categories: { ...builtInPresentationConfig.categories, uniqueBeginning: style('#000', '#ffeb3b', { underline: true, marker: true }), uniqueEnding: style('#000', '#ffeb3b', { underline: true, marker: true }), frequency1: style('#003cff', '#fff'), frequency2: style('#007a36', '#fff'), frequency3: style('#c00000', '#fff') } },
  minimal: { ...builtInPresentationConfig, preset: 'minimal', categories: { ...builtInPresentationConfig.categories, uniqueBeginning: style('#173f45', 'transparent', { underline: false, bold: false, marker: true }), uniqueEnding: style('#173f45', 'transparent', { underline: false, bold: false, marker: true }), frequency1: style('#2563eb', 'transparent', { bold: false }), frequency2: style('#16834b', 'transparent', { bold: false }), frequency3: style('#c33b32', 'transparent', { bold: false }) } },
};

export const PRESENTATION_CONFIG_KEY = 'bq-search-presentation-config-v1';
export const ADMIN_PRESENTATION_CONFIG_KEY = 'bq-search-admin-presentation-v1';

export function categoryForAnnotation(type: AnnotationType): FormattingCategory {
  if (type === 'unique-beginning') return 'uniqueBeginning';
  if (type === 'unique-ending') return 'uniqueEnding';
  if (type === 'frequency-1') return 'frequency1';
  if (type === 'frequency-2') return 'frequency2';
  return 'frequency3';
}

export function clonePresentationConfig(config: PresentationConfig): PresentationConfig { return JSON.parse(JSON.stringify(config)) as PresentationConfig; }

export function loadPresentationConfig(key = PRESENTATION_CONFIG_KEY): PresentationConfig {
  try { if (typeof localStorage === 'undefined') return clonePresentationConfig(builtInPresentationConfig); const raw = localStorage.getItem(key) ?? (key === PRESENTATION_CONFIG_KEY ? localStorage.getItem(ADMIN_PRESENTATION_CONFIG_KEY) : null); const value = JSON.parse(raw ?? 'null') as Partial<PresentationConfig> | null; if (value?.version === '1.0' && value.categories) return { ...builtInPresentationConfig, ...value, categories: { ...builtInPresentationConfig.categories, ...value.categories } as PresentationConfig['categories'] }; } catch { /* use built-in fallback */ }
  return clonePresentationConfig(builtInPresentationConfig);
}

export function savePresentationConfig(config: PresentationConfig, key = PRESENTATION_CONFIG_KEY): void { try { localStorage.setItem(key, JSON.stringify(config)); } catch { /* local preferences are optional */ } }
