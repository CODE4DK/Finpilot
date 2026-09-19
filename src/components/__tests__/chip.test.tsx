import { Chip } from '@/components/chip';
import { fireEvent, renderWithTheme, screen } from '@/test-utils/render';

describe('<Chip />', () => {
  it('renders the label and reports presses', async () => {
    const onPress = jest.fn();
    await renderWithTheme(<Chip label="Food" onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Food' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('exposes its selected state', async () => {
    await renderWithTheme(<Chip label="Food" selected onPress={() => {}} />);
    expect(screen.getByRole('button', { name: 'Food' })).toBeSelected();
  });

  it('does not fire when disabled', async () => {
    const onPress = jest.fn();
    await renderWithTheme(<Chip label="Food" disabled onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Food' }));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('pads a short pill out to a 44pt target with hitSlop', async () => {
    await renderWithTheme(<Chip label="Food" onPress={() => {}} />);
    expect(screen.getByRole('button', { name: 'Food' })).toHaveProp('hitSlop', {
      top: 6,
      bottom: 6,
      left: 4,
      right: 4,
    });
  });

  it('is a plain label when not pressable', async () => {
    await renderWithTheme(<Chip label="Income" tone="income" />);
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
    expect(screen.getByText('Income')).toBeOnTheScreen();
  });
});
