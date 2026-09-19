import { useQuery } from '@powersync/react-native';
import { useMemo } from 'react';

import { useGoalContributionsRepository, useGoals } from '@/db/hooks';
import type { GoalContributionRow } from '@/db/repositories/goals';

import { summariseGoal, type GoalSummary } from './projection';

/** One goal with its contributions and everything derived from them. */
export function useGoal(goalId: string | undefined) {
  const { data: goals } = useGoals();
  const repository = useGoalContributionsRepository();

  const goal = goals.find((candidate) => candidate.id === goalId);

  const query = useMemo(
    () => (repository && goalId ? repository.listQuery(goalId) : null),
    [goalId, repository],
  );

  const { data: contributions } = useQuery<GoalContributionRow>(
    query?.sql ?? 'SELECT 1 WHERE 0',
    query?.parameters ?? [],
  );

  const summary = useMemo<GoalSummary | null>(
    () => (goal ? summariseGoal(goal, contributions) : null),
    [contributions, goal],
  );

  return { goal, contributions, summary };
}
