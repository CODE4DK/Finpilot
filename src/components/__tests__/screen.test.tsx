import { Text } from 'react-native';

import { Screen } from '@/components/screen';
import { renderWithTheme, screen } from '@/test-utils/render';

describe('<Screen />', () => {
  it('labels itself as the screen landmark', async () => {
    await renderWithTheme(
      <Screen accessibilityLabel="Home screen">
        <Text>Body</Text>
      </Screen>,
    );
    expect(screen.getByLabelText('Home screen')).toBeOnTheScreen();
    expect(screen.getByText('Body')).toBeOnTheScreen();
  });

  it('renders a scroll view when scrollable', async () => {
    await renderWithTheme(
      <Screen accessibilityLabel="Home screen" scrollable testID="screen">
        <Text>Body</Text>
      </Screen>,
    );
    expect(screen.getByText('Body')).toBeOnTheScreen();
    expect(screen.getByTestId('screen-scroll')).toBeOnTheScreen();
  });

  it('does not scroll when told not to', async () => {
    await renderWithTheme(
      <Screen accessibilityLabel="Home screen" testID="screen">
        <Text>Body</Text>
      </Screen>,
    );
    expect(screen.queryByTestId('screen-scroll')).not.toBeOnTheScreen();
  });

  it('applies the themed background', async () => {
    await renderWithTheme(
      <Screen accessibilityLabel="Home screen" testID="screen">
        <Text>Body</Text>
      </Screen>,
      { theme: 'dark' },
    );
    expect(screen.getByTestId('screen')).toHaveStyle({ backgroundColor: '#0B1220' });
  });
});
