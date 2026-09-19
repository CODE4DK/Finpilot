/**
 * WCAG 2.1 contrast maths. Used by the theme tests to keep every palette
 * change honest: text pairs must clear AA (4.5:1), large text and UI
 * boundaries must clear 3:1.
 */

export const AA_TEXT = 4.5;
export const AA_LARGE_TEXT = 3;
export const AA_NON_TEXT = 3;

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): Rgb {
  const normalised = hex.replace('#', '');
  const expanded =
    normalised.length === 3
      ? normalised
          .split('')
          .map((char) => char + char)
          .join('')
      : normalised;

  if (!/^[0-9a-f]{6}$/i.test(expanded)) {
    throw new Error(`Expected a 3- or 6-digit hex colour, received: ${hex}`);
  }

  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  };
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const channel = (value: number): number => {
    const srgb = value / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Contrast ratio between two colours, from 1:1 to 21:1. */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

export function meetsContrast(foreground: string, background: string, minimum: number): boolean {
  return contrastRatio(foreground, background) >= minimum;
}

/** Pick whichever of two foregrounds reads better on `background`. */
export function pickReadableForeground(
  background: string,
  candidates: readonly [string, string],
): string {
  const [first, second] = candidates;
  return contrastRatio(first, background) >= contrastRatio(second, background) ? first : second;
}
