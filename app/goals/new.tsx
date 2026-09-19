import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, Text, View } from 'react-native';

import { AmountInput, Button, Chip, ListItem, Screen, TextInput, useToast } from '@/components';
import { useGoalsRepository } from '@/db/hooks';
import { useTheme } from '@/theme';

const GOAL_GLYPHS = [
  'flag-outline',
  'umbrella-outline',
  'airplane-outline',
  'home-outline',
  'car-outline',
  'school-outline',
  'laptop-outline',
  'gift-outline',
] as const;

export default function NewGoalScreen() {
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();
  const repository = useGoalsRepository();

  const [name, setName] = useState('');
  const [targetPaise, setTargetPaise] = useState<number | null>(null);
  const [targetDate, setTargetDate] = useState<Date | null>(null);
  const [icon, setIcon] = useState<string>('flag-outline');
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && targetPaise !== null && targetPaise > 0;

  const save = async () => {
    if (!repository || !canSave) {
      return;
    }
    setSaving(true);
    try {
      await repository.insert({
        name: trimmed,
        target_paise: targetPaise!,
        target_date: targetDate ? targetDate.toISOString().slice(0, 10) : null,
        icon,
        status: 'active',
      });
      toast.show('Goal created', { tone: 'success' });
      router.back();
    } catch {
      toast.show('Could not create the goal', { tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen accessibilityLabel="New goal screen" scrollable>
      <TextInput
        label="What are you saving for?"
        value={name}
        onChangeText={setName}
        placeholder="Emergency fund"
        autoCapitalize="sentences"
        autoFocus
        maxLength={80}
      />

      <AmountInput label="Target" valuePaise={targetPaise} onChangePaise={setTargetPaise} />

      <ListItem
        title="Target date"
        subtitle={
          targetDate
            ? targetDate.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })
            : 'Optional — set one to see what to save each month'
        }
        leading={<Ionicons name="calendar-outline" size={22} color={theme.colors.primary} />}
        trailing={<Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />}
        onPress={() => setShowPicker(true)}
        accessibilityLabel="Choose a target date"
      />

      <View style={{ gap: theme.spacing.sm }}>
        <Text style={[theme.typography.label, { color: theme.colors.textSecondary }]}>Icon</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {GOAL_GLYPHS.map((glyph) => (
            <Chip
              key={glyph}
              label={glyph.replace('-outline', '')}
              selected={icon === glyph}
              onPress={() => setIcon(glyph)}
              accessibilityLabel={`Use the ${glyph.replace('-outline', '')} icon`}
            />
          ))}
        </View>
      </View>

      <Button
        label="Create goal"
        fullWidth
        loading={saving}
        disabled={!canSave}
        onPress={() => void save()}
      />

      {showPicker ? (
        <DateTimePicker
          value={targetDate ?? new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={new Date()}
          onChange={(_event, date) => {
            setShowPicker(Platform.OS === 'ios');
            if (date) {
              setTargetDate(date);
            }
          }}
        />
      ) : null}
    </Screen>
  );
}
