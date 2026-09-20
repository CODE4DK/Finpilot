import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * The app's identity, per build profile.
 *
 * `APP_VARIANT` is set by the EAS profile (see eas.json) and defaults to
 * development, so a local `npx expo start` behaves like a development build
 * without anyone having to remember a flag.
 *
 * The reason this is a `.ts` file rather than `app.json`: development,
 * preview and production have to be installable **side by side** on one
 * device. That means a different bundle identifier and a different name per
 * variant, which a static file cannot express.
 */

type Variant = 'development' | 'preview' | 'production';

const VARIANT = (process.env.APP_VARIANT ?? 'development') as Variant;

/**
 * The reverse-DNS prefix. `com.code4dk` is this repository's owner; change it
 * once, here, before the first store submission - a bundle identifier cannot
 * be changed afterwards without shipping a different app.
 */
const BUNDLE_PREFIX = 'com.code4dk.finpilot';

interface VariantConfig {
  name: string;
  bundleId: string;
  /** The EAS Update channel this build listens on. */
  channel: string;
  scheme: string;
  /** Sentry only reports from builds a developer is not watching. */
  sentryEnabled: boolean;
}

const VARIANTS: Record<Variant, VariantConfig> = {
  development: {
    name: 'FinPilot Dev',
    bundleId: `${BUNDLE_PREFIX}.dev`,
    channel: 'development',
    scheme: 'finpilot-dev',
    sentryEnabled: false,
  },
  preview: {
    name: 'FinPilot Preview',
    bundleId: `${BUNDLE_PREFIX}.preview`,
    channel: 'preview',
    scheme: 'finpilot-preview',
    sentryEnabled: true,
  },
  production: {
    name: 'FinPilot',
    bundleId: BUNDLE_PREFIX,
    channel: 'production',
    scheme: 'finpilot',
    sentryEnabled: true,
  },
};

const variant = VARIANTS[VARIANT];

const projectId = process.env.EAS_PROJECT_ID;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: variant.name,
  slug: 'finpilot',
  // The marketing version. The build number is managed remotely by EAS
  // (`appVersionSource: "remote"` + `autoIncrement`), so nothing in git has
  // to be bumped to produce a build.
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: variant.scheme,
  userInterfaceStyle: 'automatic',
  // The new architecture, which this app has been on since Phase 0. Expo's
  // published config types for this SDK do not declare the key yet, though
  // prebuild reads it - hence the spread rather than a plain property.
  ...({ newArchEnabled: true } as Partial<ExpoConfig>),

  /**
   * `appVersion` ties an update to the native build it was compiled against.
   * An over-the-air update may only change JavaScript; if a build changed a
   * native module, its runtime version differs and the old binary correctly
   * refuses the new bundle rather than crashing on a missing native method.
   *
   * This is the conservative choice: a native change means a store release,
   * not an OTA. `fingerprint` would be finer-grained, but it makes "can this
   * update reach that build?" a question only a tool can answer, and the
   * answer matters most during an incident.
   */
  runtimeVersion: { policy: 'appVersion' },

  updates: {
    // `eas init` sets EAS_PROJECT_ID; the URL is derived from it rather than
    // pasted in, so a fork pointing at a different EAS project cannot
    // accidentally pull this one's updates.
    url: projectId ? `https://u.expo.dev/${projectId}` : undefined,
    // 10 seconds, then start anyway on whatever bundle is on disk. A user
    // opening a finance app on a train should not wait on the network.
    fallbackToCacheTimeout: 10_000,
  },

  ios: {
    supportsTablet: true,
    bundleIdentifier: variant.bundleId,
    usesAppleSignIn: true,
    buildNumber: undefined,
    infoPlist: {
      // The app is not a web browser and talks only to the user's own
      // Supabase project over HTTPS.
      NSAllowsArbitraryLoads: false,
      ITSAppUsesNonExemptEncryption: false,
    },
  },

  android: {
    package: variant.bundleId,
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },

  web: { favicon: './assets/favicon.png' },

  plugins: [
    'expo-router',
    'expo-dev-client',
    'expo-secure-store',
    'expo-web-browser',
    'expo-apple-authentication',
    'expo-updates',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 180,
        resizeMode: 'contain',
        // The light and dark surfaces from src/theme/colors.ts, so the splash
        // does not flash the wrong background before the app paints.
        backgroundColor: '#F7F9FC',
        dark: { backgroundColor: '#0F1720' },
      },
    ],
    ['expo-local-authentication', { faceIDPermission: 'Allow FinPilot to unlock with Face ID.' }],
    ['expo-notifications', { color: '#0B6B62', defaultChannel: 'budget-alerts' }],
    [
      '@sentry/react-native/expo',
      {
        organization: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        // The auth token is read from SENTRY_AUTH_TOKEN at build time and is
        // never written into the bundle - it belongs in EAS secrets.
        url: 'https://sentry.io/',
      },
    ],
  ],

  experiments: { typedRoutes: true },

  extra: {
    ...config.extra,
    variant: VARIANT,
    channel: variant.channel,
    sentryEnabled: variant.sentryEnabled,
    eas: { projectId },
  },
});
