import * as Notifications from 'expo-notifications';

import {
  ANDROID_CHANNEL_ID,
  deliver,
  getPermissionState,
  requestPermission,
} from '@/features/budgets/notifications';

const mockNotifications = Notifications as jest.Mocked<typeof Notifications>;

describe('getPermissionState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports granted', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValueOnce({
      status: 'granted',
      canAskAgain: true,
    } as never);

    expect(await getPermissionState()).toBe('granted');
  });

  it('reports undetermined while the OS will still ask', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValueOnce({
      status: 'undetermined',
      canAskAgain: true,
    } as never);

    expect(await getPermissionState()).toBe('undetermined');
  });

  it('reports denied once the OS will not ask again', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValueOnce({
      status: 'denied',
      canAskAgain: false,
    } as never);

    expect(await getPermissionState()).toBe('denied');
  });

  it('treats a denial we can still ask about as undetermined', async () => {
    // Android lets the prompt reappear; the toggle stays offerable.
    mockNotifications.getPermissionsAsync.mockResolvedValueOnce({
      status: 'denied',
      canAskAgain: true,
    } as never);

    expect(await getPermissionState()).toBe('undetermined');
  });
});

describe('requestPermission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not prompt again when already granted', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValueOnce({
      status: 'granted',
      canAskAgain: true,
    } as never);

    expect(await requestPermission()).toBe('granted');
    expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('does not prompt when the OS has stopped asking', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValueOnce({
      status: 'denied',
      canAskAgain: false,
    } as never);

    expect(await requestPermission()).toBe('denied');
    expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('prompts when the decision has not been made', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValueOnce({
      status: 'undetermined',
      canAskAgain: true,
    } as never);
    mockNotifications.requestPermissionsAsync.mockResolvedValueOnce({
      status: 'granted',
    } as never);

    expect(await requestPermission()).toBe('granted');
    expect(mockNotifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('reports the refusal when the user says no', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValueOnce({
      status: 'undetermined',
      canAskAgain: true,
    } as never);
    mockNotifications.requestPermissionsAsync.mockResolvedValueOnce({
      status: 'denied',
    } as never);

    expect(await requestPermission()).toBe('denied');
  });
});

describe('deliver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends nothing without permission', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValueOnce({
      status: 'undetermined',
      canAskAgain: true,
    } as never);

    expect(await deliver({ title: 'Food budget', body: '80% used' })).toBe(false);
    expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('delivers immediately when permitted', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValueOnce({
      status: 'granted',
      canAskAgain: true,
    } as never);

    expect(await deliver({ title: 'Food budget', body: '80% used' })).toBe(true);

    const [call] = mockNotifications.scheduleNotificationAsync.mock.calls;
    expect(call?.[0]).toMatchObject({
      content: { title: 'Food budget', body: '80% used' },
      // These react to something that already happened, so they fire now
      // rather than being scheduled.
      trigger: null,
    });
  });

  it('carries data through for deep linking', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValueOnce({
      status: 'granted',
      canAskAgain: true,
    } as never);

    await deliver({ title: 't', body: 'b', data: { budgetId: 'b1', threshold: 100 } });

    expect(mockNotifications.scheduleNotificationAsync.mock.calls[0]?.[0]).toMatchObject({
      content: { data: { budgetId: 'b1', threshold: 100 } },
    });
  });

  it('names a channel for Android', () => {
    expect(ANDROID_CHANNEL_ID).toBe('budget-alerts');
  });
});
