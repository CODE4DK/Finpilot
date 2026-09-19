import { CATEGORY_ICONS, CategoryIcon } from '@/components/category-icon';
import { renderWithTheme, screen } from '@/test-utils/render';

describe('<CategoryIcon />', () => {
  it('is decorative by default', async () => {
    await renderWithTheme(<CategoryIcon category="food" testID="icon" />);
    expect(screen.queryByTestId('icon')).not.toBeOnTheScreen();
  });

  it('becomes an image with a label when given one', async () => {
    await renderWithTheme(<CategoryIcon category="food" accessibilityLabel="Food category" />);
    expect(screen.getByRole('image', { name: 'Food category' })).toBeOnTheScreen();
  });

  it.each([
    ['sm', 32],
    ['md', 40],
    ['lg', 48],
  ] as const)('renders the %s size at %ppt', async (size, expected) => {
    await renderWithTheme(<CategoryIcon category="food" size={size} testID="icon" />);
    expect(screen.getByTestId('icon', { includeHiddenElements: true })).toHaveStyle({
      height: expected,
      width: expected,
    });
  });

  it('has a glyph for every category in the map', async () => {
    for (const key of Object.keys(CATEGORY_ICONS)) {
      expect(CATEGORY_ICONS[key as keyof typeof CATEGORY_ICONS]).toMatch(/-outline$|^[a-z-]+$/);
    }
  });
});
