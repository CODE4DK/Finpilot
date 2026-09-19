import { Text } from 'react-native';

import { Card } from '@/components/card';
import { fireEvent, renderWithTheme, screen } from '@/test-utils/render';

describe('<Card />', () => {
  it('renders its children', async () => {
    await renderWithTheme(
      <Card>
        <Text>Inside</Text>
      </Card>,
    );
    expect(screen.getByText('Inside')).toBeOnTheScreen();
  });

  it('becomes a button when given onPress', async () => {
    const onPress = jest.fn();
    await renderWithTheme(
      <Card onPress={onPress} accessibilityLabel="Balance card">
        <Text>Inside</Text>
      </Card>,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Balance card' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is not a button when it has no onPress', async () => {
    await renderWithTheme(
      <Card>
        <Text>Inside</Text>
      </Card>,
    );
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });

  it('can drop its padding', async () => {
    await renderWithTheme(
      <Card padded={false} testID="card">
        <Text>Inside</Text>
      </Card>,
    );
    expect(screen.getByTestId('card')).toHaveStyle({ padding: 0 });
  });
});
