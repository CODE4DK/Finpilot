/**
 * FinPilot's palette. Brand feel: calm and trustworthy - a deep teal primary
 * with an indigo accent, and unambiguous semantic colours for money movement.
 *
 * Every pair a screen actually uses is contrast-checked in
 * `src/theme/__tests__/contrast.test.ts`; change a value there and the test
 * tells you if it drops below WCAG AA.
 */

export const palette = {
  // Neutrals (slate family)
  slate950: '#0B1220',
  slate900: '#0F172A',
  slate800: '#1B2638',
  slate700: '#243044',
  slate600: '#475569',
  slate550: '#5C6A7C',
  slate500: '#64748B',
  slate450: '#818F9F',
  slate400: '#94A3B8',
  slate300: '#CBD5E1',
  slate200: '#E2E8F0',
  slate100: '#F1F5F9',
  slate50: '#F8FAFC',
  white: '#FFFFFF',
  black: '#000000',

  // Brand - deep teal
  teal900: '#04231F',
  teal800: '#075049',
  teal700: '#0B6B62',
  teal600: '#0D8177',
  teal500: '#14B8A6',
  teal400: '#2DD4BF',
  teal300: '#5EEAD4',

  // Accent - indigo
  indigo700: '#4338CA',
  indigo600: '#4F46E5',
  indigo400: '#818CF8',
  indigo300: '#A5B4FC',

  // Semantics
  green700: '#15803D',
  green400: '#4ADE80',
  red700: '#B91C1C',
  red400: '#F87171',
  amber700: '#B45309',
  amber400: '#FBBF24',
  blue700: '#1D4ED8',
  blue400: '#60A5FA',
} as const;

/**
 * The semantic token contract. Both schemes implement it, so a component only
 * ever reads `colors.<role>` and never a raw palette entry.
 */
export interface ColorTokens {
  /** Page background. */
  background: string;
  /** Raised surfaces: cards, sheets, the tab bar. */
  surface: string;
  /** Quieter fills: inputs, skeletons, chip backgrounds. */
  surfaceMuted: string;
  /** Backdrop behind modals and bottom sheets. */
  backdrop: string;

  border: string;
  borderStrong: string;

  text: string;
  textSecondary: string;
  textMuted: string;
  /** Text drawn on top of `primary`. */
  onPrimary: string;
  /** Text drawn on top of a semantic fill (income/expense/warning/info). */
  onSemantic: string;

  primary: string;
  primaryPressed: string;
  /** Tinted primary wash for selected chips, badges and progress tracks. */
  primarySubtle: string;

  accent: string;
  accentSubtle: string;

  income: string;
  incomeSubtle: string;
  expense: string;
  expenseSubtle: string;
  warning: string;
  warningSubtle: string;
  info: string;
  infoSubtle: string;

  /** Disabled fills and their labels. */
  disabled: string;
  disabledText: string;

  /** Focus ring / keyboard focus outline. */
  focus: string;
}

export const lightColors: ColorTokens = {
  background: palette.white,
  surface: palette.white,
  surfaceMuted: palette.slate100,
  backdrop: 'rgba(11, 18, 32, 0.45)',

  border: palette.slate200,
  borderStrong: palette.slate450,

  text: palette.slate900,
  textSecondary: palette.slate600,
  textMuted: palette.slate550,
  onPrimary: palette.white,
  onSemantic: palette.white,

  primary: palette.teal700,
  primaryPressed: palette.teal800,
  primarySubtle: '#E3F4F1',

  accent: palette.indigo700,
  accentSubtle: '#E9E8FB',

  income: palette.green700,
  incomeSubtle: '#EDF9F0',
  expense: palette.red700,
  expenseSubtle: '#FCE8E8',
  warning: palette.amber700,
  warningSubtle: '#FDF4E8',
  info: palette.blue700,
  infoSubtle: '#E4EBFB',

  disabled: palette.slate200,
  disabledText: palette.slate550,

  focus: palette.indigo600,
};

export const darkColors: ColorTokens = {
  background: palette.slate950,
  surface: palette.slate800,
  surfaceMuted: palette.slate700,
  backdrop: 'rgba(0, 0, 0, 0.6)',

  border: palette.slate700,
  borderStrong: palette.slate500,

  text: palette.slate50,
  textSecondary: palette.slate300,
  textMuted: palette.slate400,
  onPrimary: palette.teal900,
  onSemantic: palette.slate950,

  primary: palette.teal400,
  primaryPressed: palette.teal300,
  primarySubtle: '#123C3A',

  accent: palette.indigo400,
  accentSubtle: '#252B54',

  income: palette.green400,
  incomeSubtle: '#12331F',
  expense: palette.red400,
  expenseSubtle: '#3A1A1A',
  warning: palette.amber400,
  warningSubtle: '#3A2A10',
  info: palette.blue400,
  infoSubtle: '#15294A',

  disabled: palette.slate700,
  disabledText: palette.slate400,

  focus: palette.indigo300,
};

export type ColorSchemeName = 'light' | 'dark';

export const colorSchemes: Record<ColorSchemeName, ColorTokens> = {
  light: lightColors,
  dark: darkColors,
};
