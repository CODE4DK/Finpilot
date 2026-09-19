import { Button } from '@/components/button';
import { fireEvent, renderWithTheme, screen } from '@/test-utils/render';

describe('<Button />', () => {
  it('renders the label and calls onPress', async () => {
    const onPress = jest.fn();
    await renderWithTheme(<Button label="Save" onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('labels itself for screen readers from the label by default', async () => {
    await renderWithTheme(<Button label="Save" onPress={() => {}} />);
    expect(screen.getByLabelText('Save')).toBeOnTheScreen();
  });

  it('accepts an explicit accessibilityLabel when the label is ambiguous', async () => {
    await renderWithTheme(
      <Button label="Save" accessibilityLabel="Save transaction" onPress={() => {}} />,
    );
    expect(screen.getByLabelText('Save transaction')).toBeOnTheScreen();
  });

  it.each(['primary', 'secondary', 'tertiary', 'destructive'] as const)(
    'renders the %s variant',
    async (variant) => {
      await renderWithTheme(<Button label={variant} variant={variant} onPress={() => {}} />);
      expect(screen.getByRole('button', { name: variant })).toBeOnTheScreen();
    },
  );

  it('does not fire when disabled', async () => {
    const onPress = jest.fn();
    await renderWithTheme(<Button label="Save" disabled onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('does not fire while loading, and announces itself as busy', async () => {
    const onPress = jest.fn();
    await renderWithTheme(<Button label="Save" loading onPress={onPress} />);

    const button = screen.getByRole('button', { name: 'Save' });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button).toBeBusy();
    expect(button).toBeDisabled();
  });

  it.each([
    ['sm', 44],
    ['md', 48],
    ['lg', 56],
  ] as const)('gives the %s size a %ppt minimum touch target', async (size, minHeight) => {
    await renderWithTheme(<Button label="Tap" size={size} onPress={() => {}} />);
    expect(screen.getByRole('button', { name: 'Tap' })).toHaveStyle({ minHeight });
  });

  it('caps font scaling so the label stays inside the button', async () => {
    await renderWithTheme(<Button label="Save" onPress={() => {}} />);
    expect(screen.getByText('Save').props.maxFontSizeMultiplier).toBe(1.6);
  });
});
