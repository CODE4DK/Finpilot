/**
 * The legal links.
 *
 * Both stores require a reachable privacy policy and terms before a build can
 * ship, and a broken link is a rejection. They live here as constants so the
 * About screen, the store listing and the reviewer checklist all read the same
 * URLs.
 */

export const PRIVACY_POLICY_URL = 'https://finpilot.app/privacy';
export const TERMS_URL = 'https://finpilot.app/terms';
export const SUPPORT_EMAIL = 'support@finpilot.app';

export interface LegalLink {
  title: string;
  subtitle: string;
  url: string;
}

export const LEGAL_LINKS: LegalLink[] = [
  {
    title: 'Privacy policy',
    subtitle: 'What FinPilot stores, and what it never sends',
    url: PRIVACY_POLICY_URL,
  },
  {
    title: 'Terms of use',
    subtitle: 'The agreement for using FinPilot',
    url: TERMS_URL,
  },
];

/**
 * Only https links are ever opened from the app. A URL that arrives from
 * anywhere but this file - a synced row, a deep link - must not be able to
 * reach the browser opener.
 */
export function isSafeExternalUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}
