import { useLocalSearchParams } from 'expo-router';

import { useCategories } from '@/db/hooks';
import { CategoryFormScreen } from '@/features/categories/category-form-screen';
import type { CategoryType } from '@/db/enums';

export default function EditCategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useCategories();
  const category = data.find((candidate) => candidate.id === id);

  return (
    <CategoryFormScreen
      categoryId={id}
      title="Edit category"
      accessibilityLabel="Edit category screen"
      initialName={category?.name ?? ''}
      initialType={(category?.type as CategoryType) ?? 'expense'}
      initialIcon={category?.icon ?? null}
      isDefault={category?.is_default === 1}
    />
  );
}
