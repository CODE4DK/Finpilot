import { TextInput } from '@/components/text-input';
import { fireEvent, renderWithTheme, screen } from '@/test-utils/render';

describe('<TextInput />', () => {
  it('uses the label as the accessibility label', async () => {
    await renderWithTheme(<TextInput label="Email" value="" onChangeText={() => {}} />);
    expect(screen.getByLabelText('Email')).toBeOnTheScreen();
  });

  it('reports typing back to the caller', async () => {
    const onChangeText = jest.fn();
    await renderWithTheme(<TextInput label="Email" value="" onChangeText={onChangeText} />);

    await fireEvent.changeText(screen.getByLabelText('Email'), 'a@b.com');
    expect(onChangeText).toHaveBeenCalledWith('a@b.com');
  });

  it('shows a hint, and replaces it with the error when there is one', async () => {
    const { rerender } = await renderWithTheme(
      <TextInput label="Email" hint="We never share it" value="" onChangeText={() => {}} />,
    );
    expect(screen.getByText('We never share it')).toBeOnTheScreen();

    await rerender(
      <TextInput
        label="Email"
        hint="We never share it"
        error="Enter a valid email"
        value=""
        onChangeText={() => {}}
      />,
    );
    expect(screen.getByText('Enter a valid email')).toBeOnTheScreen();
    expect(screen.queryByText('We never share it')).not.toBeOnTheScreen();
  });

  it('keeps the label available to screen readers when visually hidden', async () => {
    await renderWithTheme(
      <TextInput label="Search" labelHidden value="" onChangeText={() => {}} />,
    );
    expect(screen.queryByText('Search')).not.toBeOnTheScreen();
    expect(screen.getByLabelText('Search')).toBeOnTheScreen();
  });

  it('meets the 44pt minimum touch target', async () => {
    await renderWithTheme(<TextInput label="Email" value="" onChangeText={() => {}} />);
    expect(screen.getByLabelText('Email').parent).toHaveStyle({ minHeight: 44 });
  });
});
