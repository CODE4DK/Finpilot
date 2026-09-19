import { Text } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { fireEvent, renderWithTheme, screen } from '@/test-utils/render';

describe('<BottomSheet />', () => {
  it('renders its content and title when visible', async () => {
    await renderWithTheme(
      <BottomSheet visible onClose={() => {}} title="Pick a category">
        <Text>Sheet body</Text>
      </BottomSheet>,
    );

    expect(screen.getByText('Pick a category')).toBeOnTheScreen();
    expect(screen.getByText('Sheet body')).toBeOnTheScreen();
  });

  it('hides its content when not visible', async () => {
    await renderWithTheme(
      <BottomSheet visible={false} onClose={() => {}} title="Pick a category">
        <Text>Sheet body</Text>
      </BottomSheet>,
    );

    expect(screen.queryByText('Sheet body')).not.toBeOnTheScreen();
  });

  it('closes when the backdrop is tapped', async () => {
    const onClose = jest.fn();
    await renderWithTheme(
      <BottomSheet visible onClose={onClose} testID="sheet">
        <Text>Sheet body</Text>
      </BottomSheet>,
    );

    // The backdrop is deliberately hidden from screen readers (it sits outside
    // accessibilityViewIsModal), so the query has to opt into hidden elements.
    await fireEvent.press(screen.getByTestId('sheet-backdrop', { includeHiddenElements: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the backdrop inert when dismissOnBackdropPress is off', async () => {
    const onClose = jest.fn();
    await renderWithTheme(
      <BottomSheet visible onClose={onClose} dismissOnBackdropPress={false} testID="sheet">
        <Text>Sheet body</Text>
      </BottomSheet>,
    );

    await fireEvent.press(screen.getByTestId('sheet-backdrop', { includeHiddenElements: true }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('offers a close button that screen readers can reach', async () => {
    const onClose = jest.fn();
    await renderWithTheme(
      <BottomSheet visible onClose={onClose} title="Pick a category">
        <Text>Sheet body</Text>
      </BottomSheet>,
    );

    const close = screen.getByRole('button', { name: 'Close' });
    await fireEvent.press(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on the Android back gesture', async () => {
    const onClose = jest.fn();
    await renderWithTheme(
      <BottomSheet visible onClose={onClose} testID="sheet">
        <Text>Sheet body</Text>
      </BottomSheet>,
    );

    await fireEvent(screen.getByTestId('sheet'), 'requestClose');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
