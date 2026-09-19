import { renderRouter, screen } from 'expo-router/testing-library';

import { useAppLockStore } from '@/features/app-lock/app-lock-store';
import { useAuthStore } from '@/features/auth/auth-store';
import { useSettingsStore } from '@/stores/settings-store';
import { MIN_TOUCH_TARGET } from '@/theme';
import {
  createFakeSupabase,
  makeProfile,
  makeSession,
  type FakeSupabase,
} from '@/test-utils/supabase-mock';

// `mock`-prefixed so jest allows the factory below to close over it.
let mockSupabase: FakeSupabase;

jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => mockSupabase,
  startSupabaseAutoRefresh: () => () => {},
}));

/**
 * The screen-reader pass, as a test rather than a one-off audit.
 *
 * A manual pass tells you the app was accessible on the day someone ran it.
 * This walks every screen on every run and asserts the three rules from
 * CLAUDE.md that are mechanically checkable:
 *
 *   * every interactive element has an accessibility label - VoiceOver and
 *     TalkBack read "button" otherwise, which says nothing;
 *   * every touch target is at least 44pt, directly or through hitSlop;
 *   * nothing opts out of OS font scaling. Dense controls cap the multiplier
 *     with `maxFontSizeMultiplier`; `allowFontScaling={false}` is never used,
 *     because it makes the app unusable for someone who needs large type.
 *
 * What it cannot check is whether a label reads *well*. That still needs a
 * person and a real screen reader, and the labels in this codebase are
 * written to be read aloud rather than to satisfy this file.
 */

const SCREENS: [url: string, label: string][] = [
  ['/', 'Home screen'],
  ['/transactions', 'Transactions screen'],
  ['/add', 'Add transaction screen'],
  ['/budgets', 'Budgets screen'],
  ['/reports', 'Reports screen'],
  ['/insights', 'Insights screen'],
  ['/insights/consent', 'AI insights consent screen'],
  ['/accounts', 'Accounts screen'],
  ['/categories', 'Categories screen'],
  ['/goals', 'Goals screen'],
  ['/recurring', 'Repeating transactions screen'],
  ['/settings', 'Settings screen'],
  ['/settings/profile', 'Profile settings screen'],
  ['/settings/notifications', 'Notification settings screen'],
  ['/settings/appearance', 'Appearance settings screen'],
  ['/settings/security', 'Security settings screen'],
  ['/settings/data', 'Data settings screen'],
  ['/settings/delete-account', 'Delete account screen'],
  ['/settings/about', 'About screen'],
];

interface Measured {
  minHeight?: number;
  height?: number;
  paddingVertical?: number;
}

/** Flattens whatever shape the style prop arrived in. */
function flatten(style: unknown): Measured {
  if (Array.isArray(style)) {
    return style.reduce<Measured>((merged, entry) => ({ ...merged, ...flatten(entry) }), {});
  }
  return (style ?? {}) as Measured;
}

/**
 * The touchable's height, or `null` when it cannot be measured from props
 * alone - a row that sizes itself from its content, or a pressable whose
 * height lives on a child view. Those are covered by the component-level
 * tests, which render the component directly and can measure it;
 * guessing here would produce failures that say nothing.
 */
function touchHeight(element: { props: Record<string, unknown> }): number | null {
  const style = flatten(element.props.style);
  const base = style.minHeight ?? style.height;
  if (typeof base !== 'number' || base === 0) {
    return null;
  }

  const hitSlop = element.props.hitSlop;
  if (typeof hitSlop === 'number') {
    return base + hitSlop * 2;
  }
  if (hitSlop && typeof hitSlop === 'object') {
    const { top = 0, bottom = 0 } = hitSlop as { top?: number; bottom?: number };
    return base + top + bottom;
  }
  return base;
}

/**
 * Walks the rendered tree for anything that turned font scaling off.
 *
 * Icon glyphs are the one legitimate exception, and they are not ours:
 * `@expo/vector-icons` renders a glyph as `<Text allowFontScaling={false}>`
 * because an icon is sized by its `size` prop, not by the reader's type
 * setting, and scaling it would break every row it sits in. They are
 * identified by their icon font family rather than by trusting the library.
 */
function countOptOuts(node: unknown): number {
  if (Array.isArray(node)) {
    return node.reduce<number>((total, child) => total + countOptOuts(child), 0);
  }
  if (!node || typeof node !== 'object') {
    return 0;
  }

  const element = node as { props?: Record<string, unknown>; children?: unknown };
  const fontFamily = flatten(element.props?.style) as { fontFamily?: string };
  const isIconGlyph = /icon|ionicons|material|fontawesome/i.test(fontFamily.fontFamily ?? '');
  const own = element.props?.allowFontScaling === false && !isIconGlyph ? 1 : 0;

  return own + countOptOuts(element.children);
}

beforeEach(() => {
  useAuthStore.getState().reset();
  useAppLockStore.getState().reset();
  useSettingsStore.getState().reset();
  mockSupabase = createFakeSupabase({ session: makeSession(), profile: makeProfile() });
});

describe('every screen is usable with a screen reader', () => {
  it.each(SCREENS)('%s labels every interactive element', async (url, label) => {
    await renderRouter('app', { initialUrl: url });
    await screen.findByLabelText(label);

    const unlabelled = screen
      .queryAllByRole('button')
      .filter((button) => !button.props.accessibilityLabel && !button.props['aria-label']);

    expect(unlabelled.map((button) => JSON.stringify(button.props.testID ?? ''))).toEqual([]);
  });

  it.each(SCREENS)('%s gives every target at least 44pt', async (url, label) => {
    await renderRouter('app', { initialUrl: url });
    await screen.findByLabelText(label);

    const tooSmall = screen
      .queryAllByRole('button')
      .filter((button) => {
        const height = touchHeight(button);
        return height !== null && height < MIN_TOUCH_TARGET;
      })
      .map((button) => button.props.accessibilityLabel);

    expect(tooSmall).toEqual([]);
  });

  it.each(SCREENS)('%s never switches OS font scaling off', async (url, label) => {
    await renderRouter('app', { initialUrl: url });
    await screen.findByLabelText(label);

    expect(countOptOuts(screen.toJSON())).toBe(0);
  });
});

describe('the screens that matter most', () => {
  it('names the tabs, not just their icons', async () => {
    await renderRouter('app', { initialUrl: '/' });
    await screen.findByLabelText('Home screen');

    for (const tab of ['Home tab', 'Transactions tab', 'Budgets tab', 'Reports tab']) {
      expect(screen.getByLabelText(tab)).toBeOnTheScreen();
    }
  });

  it('describes the destructive action in full, not as "delete"', async () => {
    await renderRouter('app', { initialUrl: '/settings/delete-account' });
    await screen.findByLabelText('Delete account screen');

    // The button says what it does and what is still required - a screen
    // reader user should not have to discover the disabled state by feel.
    expect(screen.getByLabelText('Delete my account. Type DELETE above first.')).toBeOnTheScreen();
  });

  it('announces the app version and build together', async () => {
    await renderRouter('app', { initialUrl: '/settings/about' });
    await screen.findByLabelText('About screen');

    expect(screen.getByLabelText(/Version .*, build .*/)).toBeOnTheScreen();
  });
});
