import { Skeleton, SkeletonList } from '@/components/skeleton';
import { renderWithTheme, screen } from '@/test-utils/render';

describe('<Skeleton />', () => {
  it('renders at the requested size', async () => {
    await renderWithTheme(<Skeleton width={120} height={20} testID="bone" />);
    expect(screen.getByTestId('bone', { includeHiddenElements: true })).toHaveStyle({
      width: 120,
      height: 20,
    });
  });

  it('is hidden from screen readers - it says nothing', async () => {
    await renderWithTheme(<Skeleton testID="bone" />);
    expect(screen.queryByTestId('bone')).not.toBeOnTheScreen();
    expect(screen.getByTestId('bone', { includeHiddenElements: true })).toHaveProp(
      'importantForAccessibility',
      'no-hide-descendants',
    );
  });
});

describe('<SkeletonList />', () => {
  it('announces that something is loading', async () => {
    await renderWithTheme(<SkeletonList rows={2} />);
    expect(screen.getByLabelText('Loading')).toBeOnTheScreen();
  });
});
