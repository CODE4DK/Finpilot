import {
  AA_NON_TEXT,
  AA_TEXT,
  contrastRatio,
  darkColors,
  hexToRgb,
  lightColors,
  meetsContrast,
  pickReadableForeground,
  relativeLuminance,
  type ColorTokens,
} from '@/theme';

describe('hexToRgb', () => {
  it('parses long and short hex', () => {
    expect(hexToRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb('000')).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb('#0B6B62')).toEqual({ r: 11, g: 107, b: 98 });
  });

  it('rejects nonsense', () => {
    expect(() => hexToRgb('#12345')).toThrow();
    expect(() => hexToRgb('rebeccapurple')).toThrow();
  });
});

describe('relativeLuminance', () => {
  it('anchors at black and white', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 5);
  });
});

describe('contrastRatio', () => {
  it('is 21:1 for black on white', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 2);
  });

  it('is symmetric and 1:1 for identical colours', () => {
    expect(contrastRatio('#0B6B62', '#FFFFFF')).toBeCloseTo(
      contrastRatio('#FFFFFF', '#0B6B62'),
      10,
    );
    expect(contrastRatio('#123456', '#123456')).toBeCloseTo(1, 10);
  });
});

describe('pickReadableForeground', () => {
  it('picks the more readable of two candidates', () => {
    expect(pickReadableForeground('#FFFFFF', ['#000000', '#FFFFFF'])).toBe('#000000');
    expect(pickReadableForeground('#0B1220', ['#000000', '#FFFFFF'])).toBe('#FFFFFF');
  });
});

/**
 * The guard rail for the palette: every pair a screen actually renders must
 * clear WCAG AA. Change a token in colors.ts and this test tells you whether
 * the change is shippable.
 */
const TEXT_PAIRS: [keyof ColorTokens, keyof ColorTokens][] = [
  ['text', 'background'],
  ['text', 'surface'],
  ['text', 'surfaceMuted'],
  ['textSecondary', 'background'],
  ['textSecondary', 'surface'],
  ['textSecondary', 'surfaceMuted'],
  ['textMuted', 'background'],
  ['textMuted', 'surface'],
  ['textMuted', 'surfaceMuted'],
  ['onPrimary', 'primary'],
  ['onPrimary', 'primaryPressed'],
  ['primary', 'primarySubtle'],
  ['accent', 'accentSubtle'],
  ['income', 'background'],
  ['income', 'surface'],
  ['income', 'incomeSubtle'],
  ['expense', 'background'],
  ['expense', 'surface'],
  ['expense', 'expenseSubtle'],
  ['warning', 'background'],
  ['warning', 'warningSubtle'],
  ['info', 'background'],
  ['info', 'infoSubtle'],
  ['onSemantic', 'income'],
  ['onSemantic', 'expense'],
  ['onSemantic', 'warning'],
  ['onSemantic', 'info'],
];

/** Non-text UI: fills, outlines and focus rings only need 3:1. */
const NON_TEXT_PAIRS: [keyof ColorTokens, keyof ColorTokens][] = [
  ['primary', 'background'],
  ['primary', 'surface'],
  ['accent', 'background'],
  ['borderStrong', 'background'],
  ['borderStrong', 'surface'],
  ['focus', 'background'],
  ['disabledText', 'disabled'],
];

describe.each([
  ['light', lightColors],
  ['dark', darkColors],
] as const)('%s scheme meets WCAG AA', (_name, tokens) => {
  it.each(TEXT_PAIRS)('%s on %s clears 4.5:1', (foreground, background) => {
    // Report the actual ratio in the failure message, not just "false".
    const ratio = Number(contrastRatio(tokens[foreground], tokens[background]).toFixed(2));
    expect({
      ratio,
      passes: meetsContrast(tokens[foreground], tokens[background], AA_TEXT),
    }).toEqual({ ratio, passes: true });
  });

  it.each(NON_TEXT_PAIRS)('%s on %s clears 3:1', (foreground, background) => {
    expect(meetsContrast(tokens[foreground], tokens[background], AA_NON_TEXT)).toBe(true);
  });
});
