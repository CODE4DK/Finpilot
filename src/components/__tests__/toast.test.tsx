import { Button } from '@/components/button';
import { DEFAULT_TOAST_DURATION, useToast } from '@/components/toast';
import { act, fireEvent, renderWithTheme, screen } from '@/test-utils/render';

function Harness() {
  const toast = useToast();
  return (
    <>
      <Button label="Success" onPress={() => toast.show('Saved', { tone: 'success' })} />
      <Button label="Error" onPress={() => toast.show('Failed', { tone: 'error' })} />
      <Button label="Sticky" onPress={() => toast.show('Stays', { duration: 0 })} />
    </>
  );
}

describe('<ToastProvider />', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows a toast and announces it politely', async () => {
    await renderWithTheme(<Harness />, { withToast: true });

    await fireEvent.press(screen.getByRole('button', { name: 'Success' }));

    const toast = screen.getByRole('alert', { name: 'Saved' });
    expect(toast).toBeOnTheScreen();
    expect(toast).toHaveProp('accessibilityLiveRegion', 'polite');
  });

  it('auto-dismisses after the default duration', async () => {
    await renderWithTheme(<Harness />, { withToast: true });

    await fireEvent.press(screen.getByRole('button', { name: 'Success' }));
    expect(screen.getByText('Saved')).toBeOnTheScreen();

    await act(async () => {
      jest.advanceTimersByTime(DEFAULT_TOAST_DURATION + 1);
    });

    expect(screen.queryByText('Saved')).not.toBeOnTheScreen();
  });

  it('keeps a toast with duration 0 on screen', async () => {
    await renderWithTheme(<Harness />, { withToast: true });

    await fireEvent.press(screen.getByRole('button', { name: 'Sticky' }));
    await act(async () => {
      jest.advanceTimersByTime(DEFAULT_TOAST_DURATION * 3);
    });

    expect(screen.getByText('Stays')).toBeOnTheScreen();
  });

  it('stacks multiple toasts', async () => {
    await renderWithTheme(<Harness />, { withToast: true });

    await fireEvent.press(screen.getByRole('button', { name: 'Success' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Error' }));

    expect(screen.getByText('Saved')).toBeOnTheScreen();
    expect(screen.getByText('Failed')).toBeOnTheScreen();
    expect(screen.getByTestId('toast-error')).toBeOnTheScreen();
  });

  it('throws a useful error when used outside the provider', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(renderWithTheme(<Harness />)).rejects.toThrow(
      'useToast must be used inside a <ToastProvider>',
    );
    spy.mockRestore();
  });
});
