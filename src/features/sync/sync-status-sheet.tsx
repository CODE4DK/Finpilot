import { Text, View } from 'react-native';

import { BottomSheet, Button } from '@/components';
import { formatLastSynced, type SyncSummary } from '@/db/sync-status';
import { useTheme } from '@/theme';

export interface SyncStatusSheetProps {
  visible: boolean;
  onClose: () => void;
  summary: SyncSummary;
  onRetry?: () => void;
}

const EXPLANATIONS = {
  synced: 'Everything on this device has reached the server.',
  syncing: 'Sending and receiving changes.',
  offline:
    'You can keep adding transactions. They are saved on this device and will sync when you are back online.',
  error:
    'Some changes could not be saved to the server. They are still on this device, and FinPilot will keep trying.',
} as const;

export function SyncStatusSheet({ visible, onClose, summary, onRetry }: SyncStatusSheetProps) {
  const theme = useTheme();

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Sync" testID="sync-sheet">
      <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.lg }}>
        <Text style={[theme.typography.bodyStrong, { color: theme.colors.text }]}>
          {summary.label}
        </Text>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
          {EXPLANATIONS[summary.state]}
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
          {formatLastSynced(summary.lastSyncedAt)}
        </Text>

        {summary.pendingUpload ? (
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
            Some changes are still waiting to upload.
          </Text>
        ) : null}

        {summary.state === 'error' && onRetry ? (
          <Button label="Try again" fullWidth onPress={onRetry} />
        ) : (
          <Button label="Close" variant="tertiary" fullWidth onPress={onClose} />
        )}
      </View>
    </BottomSheet>
  );
}
