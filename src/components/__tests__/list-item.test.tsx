import { Text } from 'react-native';

import { ListItem } from '@/components/list-item';
import { fireEvent, renderWithTheme, screen } from '@/test-utils/render';

describe('<ListItem />', () => {
  it('renders title and subtitle', async () => {
    await renderWithTheme(<ListItem title="Big Bazaar" subtitle="Groceries" />);
    expect(screen.getByText('Big Bazaar')).toBeOnTheScreen();
    expect(screen.getByText('Groceries')).toBeOnTheScreen();
  });

  it('builds an accessibility label from title and subtitle when pressable', async () => {
    await renderWithTheme(<ListItem title="Big Bazaar" subtitle="Groceries" onPress={() => {}} />);
    expect(screen.getByRole('button', { name: 'Big Bazaar, Groceries' })).toBeOnTheScreen();
  });

  it('reports presses', async () => {
    const onPress = jest.fn();
    await renderWithTheme(<ListItem title="Row" onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Row' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders leading and trailing slots', async () => {
    await renderWithTheme(
      <ListItem title="Row" leading={<Text>L</Text>} trailing={<Text>R</Text>} />,
    );
    expect(screen.getByText('L')).toBeOnTheScreen();
    expect(screen.getByText('R')).toBeOnTheScreen();
  });

  it('is not a button without onPress', async () => {
    await renderWithTheme(<ListItem title="Row" />);
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });

  it('clears the 44pt touch target', async () => {
    await renderWithTheme(<ListItem title="Row" onPress={() => {}} testID="row" />);
    const inner = screen.getByTestId('row').children[0];
    expect(inner).toHaveStyle({ minHeight: 56 });
  });
});
