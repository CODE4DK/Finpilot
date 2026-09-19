import { Text } from 'react-native';

import { renderWithTheme, screen } from '@/test-utils/render';
import {
  MIN_TOUCH_TARGET,
  ThemeProvider,
  createTheme,
  darkColors,
  darkTheme,
  elevation,
  fontScaleCaps,
  lightColors,
  lightTheme,
  resolveScheme,
  typography,
  useTheme,
} from '@/theme';

describe('resolveScheme', () => {
  it('follows the system when the preference is "system"', () => {
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('system', 'light')).toBe('light');
  });

  it('falls back to light when the system has no preference', () => {
    expect(resolveScheme('system', null)).toBe('light');
    expect(resolveScheme('system', undefined)).toBe('light');
    expect(resolveScheme('system', 'unspecified')).toBe('light');
  });

  it('honours a manual override regardless of the system', () => {
    expect(resolveScheme('dark', 'light')).toBe('dark');
    expect(resolveScheme('light', 'dark')).toBe('light');
  });
});

describe('createTheme', () => {
  it('bundles the tokens for a scheme', () => {
    expect(createTheme('light').colors).toBe(lightColors);
    expect(createTheme('dark').colors).toBe(darkColors);
    expect(lightTheme.minTouchTarget).toBe(MIN_TOUCH_TARGET);
    expect(darkTheme.scheme).toBe('dark');
  });

  it('exposes a scheme-aware elevation helper', () => {
    expect(lightTheme.elevation(0)).toEqual({});
    expect(Object.keys(darkTheme.elevation(2)).length).toBeGreaterThan(0);
  });
});

describe('elevation', () => {
  it('is flat at level 0', () => {
    expect(elevation(0)).toEqual({});
  });

  it('deepens with the level', () => {
    const one = elevation(1) as { shadowRadius?: number };
    const three = elevation(3) as { shadowRadius?: number };
    expect((three.shadowRadius ?? 0) > (one.shadowRadius ?? 0)).toBe(true);
  });

  it('strengthens the shadow on dark surfaces', () => {
    const light = elevation(2, 'light') as { shadowOpacity?: number };
    const dark = elevation(2, 'dark') as { shadowOpacity?: number };
    expect(dark.shadowOpacity).toBeGreaterThan(light.shadowOpacity ?? 0);
  });
});

describe('typography', () => {
  it('keeps line height above font size for every variant', () => {
    for (const [name, style] of Object.entries(typography)) {
      expect({ name, ok: (style.lineHeight ?? 0) > (style.fontSize ?? 0) }).toEqual({
        name,
        ok: true,
      });
    }
  });

  it('leaves content text uncapped and caps dense controls', () => {
    expect(fontScaleCaps.content).toBeUndefined();
    expect(fontScaleCaps.control).toBeGreaterThan(1);
    expect(fontScaleCaps.compact).toBeLessThan(fontScaleCaps.control);
  });
});

function ThemeProbe() {
  const theme = useTheme();
  return <Text>{theme.scheme}</Text>;
}

describe('<ThemeProvider />', () => {
  it('renders the light scheme by default', async () => {
    await renderWithTheme(<ThemeProbe />);
    expect(screen.getByText('light')).toBeOnTheScreen();
  });

  it('renders the dark scheme when overridden', async () => {
    await renderWithTheme(<ThemeProbe />, { theme: 'dark' });
    expect(screen.getByText('dark')).toBeOnTheScreen();
  });

  it('follows an injected system scheme when the preference is "system"', async () => {
    await renderWithTheme(
      <ThemeProvider preference="system" systemScheme="dark">
        <ThemeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByText('dark')).toBeOnTheScreen();
  });
});
