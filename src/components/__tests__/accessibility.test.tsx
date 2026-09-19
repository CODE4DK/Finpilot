import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { ListItem } from '@/components/list-item';
import { MIN_TOUCH_TARGET } from '@/theme';
import { renderWithTheme, screen } from '@/test-utils/render';

/**
 * Cross-cutting accessibility rules from CLAUDE.md, asserted once over the
 * interactive parts of the library rather than repeated in every file.
 */
describe('accessibility contract', () => {
  it('every interactive element carries an accessibilityLabel and a role', async () => {
    await renderWithTheme(
      <>
        <Button label="Save" onPress={() => {}} />
        <Chip label="Food" onPress={() => {}} />
        <ListItem title="Row" subtitle="Detail" onPress={() => {}} />
      </>,
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
    for (const button of buttons) {
      expect(button.props.accessibilityLabel).toBeTruthy();
    }
  });

  it('gives pressables at least a 44pt target, directly or via hitSlop', async () => {
    await renderWithTheme(
      <>
        <Button label="Save" size="sm" onPress={() => {}} />
        <Chip label="Food" onPress={() => {}} />
      </>,
    );

    const [button, chip] = screen.getAllByRole('button');
    expect(button).toHaveStyle({ minHeight: MIN_TOUCH_TARGET });

    // The chip's pill is 32pt; hitSlop makes up the remaining 12pt.
    const hitSlop = chip?.props.hitSlop as { top: number; bottom: number };
    expect(32 + hitSlop.top + hitSlop.bottom).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  });

  it('allows OS font scaling, capped only where layout demands it', async () => {
    await renderWithTheme(<Button label="Save" onPress={() => {}} />);

    const label = screen.getByText('Save');
    // Scaling is on (RN's default) with a cap, never allowFontScaling={false}.
    expect(label.props.allowFontScaling).not.toBe(false);
    expect(label.props.maxFontSizeMultiplier).toBeGreaterThan(1);
  });
});
