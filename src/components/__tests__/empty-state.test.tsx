import { EmptyState } from '@/components/empty-state';
import { fireEvent, renderWithTheme, screen } from '@/test-utils/render';

describe('<EmptyState />', () => {
  it('renders the title and description', async () => {
    await renderWithTheme(<EmptyState title="Nothing here" description="Add something" />);
    expect(screen.getByText('Nothing here')).toBeOnTheScreen();
    expect(screen.getByText('Add something')).toBeOnTheScreen();
  });

  it('reads as one unit to screen readers', async () => {
    await renderWithTheme(<EmptyState title="Nothing here" description="Add something" />);
    expect(screen.getByLabelText('Nothing here. Add something')).toBeOnTheScreen();
  });

  it('renders an action when given one', async () => {
    const onAction = jest.fn();
    await renderWithTheme(
      <EmptyState title="Nothing here" actionLabel="Add transaction" onAction={onAction} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Add transaction' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('omits the action when there is no handler', async () => {
    await renderWithTheme(<EmptyState title="Nothing here" actionLabel="Add transaction" />);
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });
});
