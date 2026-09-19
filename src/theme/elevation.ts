import { Platform, type ViewStyle } from 'react-native';

/**
 * Cross-platform elevation. iOS gets a shadow, Android gets `elevation`, and
 * dark mode leans on a lifted surface colour instead of a shadow (shadows are
 * close to invisible on a dark background).
 */
export type ElevationLevel = 0 | 1 | 2 | 3;

const IOS_SHADOWS: Record<ElevationLevel, ViewStyle> = {
  0: {},
  1: {
    shadowColor: '#0B1220',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  2: {
    shadowColor: '#0B1220',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  3: {
    shadowColor: '#0B1220',
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
};

const ANDROID_ELEVATION: Record<ElevationLevel, ViewStyle> = {
  0: { elevation: 0 },
  1: { elevation: 1 },
  2: { elevation: 4 },
  3: { elevation: 10 },
};

export function elevation(level: ElevationLevel, scheme: 'light' | 'dark' = 'light'): ViewStyle {
  if (level === 0) {
    return {};
  }
  if (Platform.OS === 'android') {
    return ANDROID_ELEVATION[level];
  }
  // Dark surfaces read as "raised" through colour, so soften the shadow.
  const shadow = IOS_SHADOWS[level];
  if (scheme === 'dark') {
    const opacity = typeof shadow.shadowOpacity === 'number' ? shadow.shadowOpacity : 0;
    return { ...shadow, shadowOpacity: opacity * 1.8, shadowColor: '#000000' };
  }
  return shadow;
}
