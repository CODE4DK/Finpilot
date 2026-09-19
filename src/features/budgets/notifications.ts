import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Local notifications for budget alerts.
 *
 * Permission is **never** requested at launch. A prompt with no context is the
 * one users deny permanently, and iOS only asks once. It is requested when the
 * user turns budget alerts on, at which point the ask explains itself.
 */

export const ANDROID_CHANNEL_ID = 'budget-alerts';

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export async function getPermissionState(): Promise<PermissionState> {
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();

  if (status === 'granted') {
    return 'granted';
  }
  // A denial we can still ask about is "undetermined" as far as the UI cares:
  // the toggle stays offerable.
  return canAskAgain ? 'undetermined' : 'denied';
}

/**
 * Asks for permission. Only call this from a deliberate user action - turning
 * on alerts - never on mount.
 */
export async function requestPermission(): Promise<PermissionState> {
  const current = await getPermissionState();
  if (current === 'granted') {
    return 'granted';
  }
  if (current === 'denied') {
    // The OS will not show the prompt again; the UI points at Settings.
    return 'denied';
  }

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted' ? 'granted' : 'denied';
}

/** Android needs a channel before anything can be delivered. */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Budget alerts',
    importance: Notifications.AndroidImportance.DEFAULT,
    // A budget crossing 80% is information, not an emergency.
    vibrationPattern: [0, 200],
    enableVibrate: true,
  });
}

export interface LocalNotification {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/** Delivers immediately. Returns false when permission is not granted. */
export async function deliver(notification: LocalNotification): Promise<boolean> {
  if ((await getPermissionState()) !== 'granted') {
    return false;
  }

  await ensureAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: notification.title,
      body: notification.body,
      data: notification.data ?? {},
    },
    // null means "now"; these are reactions to something that already
    // happened, not reminders.
    trigger: null,
  });

  return true;
}

/** How the app behaves when a notification arrives while it is open. */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}
