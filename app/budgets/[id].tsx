import { useLocalSearchParams } from 'expo-router';

import { BudgetFormScreen } from '@/features/budgets/budget-form-screen';

export default function EditBudgetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <BudgetFormScreen budgetId={id} title="Edit budget" accessibilityLabel="Edit budget screen" />
  );
}
