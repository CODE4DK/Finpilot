import { colorSchemes, type ColorSchemeName, type ColorTokens } from './colors';
import { elevation, type ElevationLevel } from './elevation';
import { MIN_TOUCH_TARGET, radius, spacing } from './spacing';
import { fontScaleCaps, typography } from './typography';

export interface Theme {
  scheme: ColorSchemeName;
  colors: ColorTokens;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  fontScaleCaps: typeof fontScaleCaps;
  minTouchTarget: number;
  elevation: (level: ElevationLevel) => ReturnType<typeof elevation>;
}

export function createTheme(scheme: ColorSchemeName): Theme {
  return {
    scheme,
    colors: colorSchemes[scheme],
    spacing,
    radius,
    typography,
    fontScaleCaps,
    minTouchTarget: MIN_TOUCH_TARGET,
    elevation: (level) => elevation(level, scheme),
  };
}

export const lightTheme = createTheme('light');
export const darkTheme = createTheme('dark');
