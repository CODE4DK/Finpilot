import type { TextStyle } from 'react-native';

/**
 * Type scale. Sizes are unscaled base values - React Native multiplies them by
 * the OS font-scale setting, which we deliberately allow (accessibility), while
 * capping the multiplier on dense UI so layouts do not shatter at 200%.
 */
export const typography = {
  display: { fontSize: 32, fontWeight: '700', lineHeight: 38, letterSpacing: -0.5 },
  title: { fontSize: 24, fontWeight: '700', lineHeight: 30, letterSpacing: -0.3 },
  heading: { fontSize: 20, fontWeight: '600', lineHeight: 26 },
  subheading: { fontSize: 17, fontWeight: '600', lineHeight: 23 },
  body: { fontSize: 16, fontWeight: '400', lineHeight: 22 },
  bodyStrong: { fontSize: 16, fontWeight: '600', lineHeight: 22 },
  label: { fontSize: 14, fontWeight: '500', lineHeight: 19 },
  caption: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  overline: { fontSize: 11, fontWeight: '600', lineHeight: 14, letterSpacing: 0.8 },
  /** Large balances and totals. */
  amountLarge: { fontSize: 34, fontWeight: '700', lineHeight: 41, letterSpacing: -0.5 },
  amount: { fontSize: 20, fontWeight: '600', lineHeight: 26 },
  amountSmall: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;

/**
 * Caps for `maxFontSizeMultiplier`. Body copy is allowed to grow without limit;
 * components whose height is constrained (tabs, chips, buttons) are capped so
 * that a 200% system font does not push labels out of their container.
 */
export const fontScaleCaps = {
  /** Free-flowing text - no cap. */
  content: undefined,
  /** Fixed-height controls: buttons, chips, list rows. */
  control: 1.6,
  /** Very tight surfaces: tab bar labels, badges. */
  compact: 1.3,
} as const;
