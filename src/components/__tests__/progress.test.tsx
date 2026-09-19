import { Text } from 'react-native';

import { ProgressBar, clampProgress, toneForProgress } from '@/components/progress-bar';
import { ProgressRing, describeRing } from '@/components/progress-ring';
import { renderWithTheme, screen } from '@/test-utils/render';

describe('clampProgress', () => {
  it.each([
    [-1, 0],
    [0, 0],
    [0.5, 0.5],
    [1, 1],
    [1.7, 1],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 1],
  ])('clamps %p to %p', (input, expected) => {
    expect(clampProgress(input)).toBe(expected);
  });
});

describe('toneForProgress', () => {
  it.each([
    [0, 'primary'],
    [0.79, 'primary'],
    [0.8, 'warning'],
    [0.99, 'warning'],
    [1, 'expense'],
    [1.5, 'expense'],
  ] as const)('maps %p to the %s tone', (progress, tone) => {
    expect(toneForProgress(progress)).toBe(tone);
  });
});

describe('<ProgressBar />', () => {
  it('announces its value as a percentage', async () => {
    await renderWithTheme(<ProgressBar progress={0.62} accessibilityLabel="Budget used" />);
    expect(screen.getByRole('progressbar', { name: 'Budget used' })).toHaveAccessibilityValue({
      min: 0,
      max: 100,
      now: 62,
    });
  });

  it('clamps an over-budget value to 100%', async () => {
    await renderWithTheme(<ProgressBar progress={1.4} accessibilityLabel="Budget used" />);
    expect(screen.getByRole('progressbar', { name: 'Budget used' })).toHaveAccessibilityValue({
      min: 0,
      max: 100,
      now: 100,
    });
  });

  it('fills to the clamped width', async () => {
    await renderWithTheme(<ProgressBar progress={0.25} testID="bar" />);
    expect(screen.getByTestId('bar-fill')).toHaveStyle({ width: '25%' });
  });

  it('falls back to the label for its accessible name', async () => {
    await renderWithTheme(<ProgressBar progress={0.1} label="Monthly budget" />);
    expect(screen.getByRole('progressbar', { name: 'Monthly budget' })).toBeOnTheScreen();
  });
});

describe('describeRing', () => {
  it('computes the radius and circumference from the outer size', () => {
    const { radius, circumference } = describeRing(120, 10, 0);
    expect(radius).toBe(55);
    expect(circumference).toBeCloseTo(2 * Math.PI * 55, 5);
  });

  it('offsets the dash by the remaining fraction', () => {
    const { circumference, dashOffset } = describeRing(100, 8, 0.25);
    expect(dashOffset).toBeCloseTo(circumference * 0.75, 5);
  });

  it('is empty at 0 and full at 1', () => {
    expect(describeRing(100, 8, 0).dashOffset).toBeCloseTo(
      describeRing(100, 8, 0).circumference,
      5,
    );
    expect(describeRing(100, 8, 1).dashOffset).toBe(0);
  });

  it('clamps out-of-range progress', () => {
    expect(describeRing(100, 8, 2).percent).toBe(100);
    expect(describeRing(100, 8, -1).percent).toBe(0);
  });
});

describe('<ProgressRing />', () => {
  it('announces its value and renders its centre content', async () => {
    await renderWithTheme(
      <ProgressRing progress={0.4} accessibilityLabel="Budget used">
        <Text>40%</Text>
      </ProgressRing>,
    );

    expect(screen.getByRole('progressbar', { name: 'Budget used' })).toHaveAccessibilityValue({
      min: 0,
      max: 100,
      now: 40,
    });
    expect(screen.getByText('40%')).toBeOnTheScreen();
  });
});
