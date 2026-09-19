import type { TextStyle } from 'react-native';

export const typography = {
  title: { fontSize: 28, fontWeight: '700', lineHeight: 34 },
  heading: { fontSize: 20, fontWeight: '600', lineHeight: 26 },
  body: { fontSize: 16, fontWeight: '400', lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  amount: { fontSize: 32, fontWeight: '700', lineHeight: 38 },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
