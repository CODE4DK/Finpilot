export const palette = {
  ink900: '#0B1220',
  ink700: '#1F2937',
  ink500: '#4B5563',
  ink300: '#9CA3AF',
  ink100: '#E5E7EB',
  ink50: '#F3F4F6',
  white: '#FFFFFF',
  teal600: '#0F766E',
  teal500: '#14B8A6',
  amber500: '#F59E0B',
  red600: '#DC2626',
  green600: '#16A34A',
} as const;

export const lightColors = {
  background: palette.white,
  surface: palette.ink50,
  border: palette.ink100,
  text: palette.ink900,
  textMuted: palette.ink500,
  primary: palette.teal600,
  income: palette.green600,
  expense: palette.red600,
  warning: palette.amber500,
} as const;

export const darkColors = {
  background: palette.ink900,
  surface: palette.ink700,
  border: palette.ink700,
  text: palette.white,
  textMuted: palette.ink300,
  primary: palette.teal500,
  income: palette.green600,
  expense: palette.red600,
  warning: palette.amber500,
} as const;

export type ColorScheme = typeof lightColors;
