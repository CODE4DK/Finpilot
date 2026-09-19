import {
  averageMonthlyPaise,
  formatProjectionDate,
  isComplete,
  monthsUntil,
  progressFraction,
  progressPercentage,
  projectCompletion,
  remainingPaise,
  requiredMonthlyPaise,
  savedPaise,
  summariseGoal,
  type ContributionLike,
  type GoalLike,
} from '@/features/goals/projection';

const NOW = new Date(2026, 8, 19); // 19 September 2026
const TARGET = 50000000; // ₹5,00,000

function goal(overrides: Partial<GoalLike> = {}): GoalLike {
  return {
    id: 'goal-1',
    target_paise: TARGET,
    target_date: new Date(2027, 8, 1).toISOString(),
    status: 'active',
    created_at: new Date(2026, 5, 1).toISOString(),
    ...overrides,
  };
}

function contribution(amount: number, date: Date, deleted = false): ContributionLike {
  return {
    amount_paise: amount,
    contributed_at: date.toISOString(),
    deleted_at: deleted ? date.toISOString() : null,
  };
}

describe('savedPaise', () => {
  it('adds contributions up', () => {
    expect(
      savedPaise([
        contribution(1000000, new Date(2026, 6, 1)),
        contribution(1500000, new Date(2026, 7, 1)),
      ]),
    ).toBe(2500000);
  });

  it('ignores soft-deleted contributions', () => {
    expect(
      savedPaise([
        contribution(1000000, new Date(2026, 6, 1)),
        contribution(9999999, new Date(2026, 7, 1), true),
      ]),
    ).toBe(1000000);
  });

  it('is zero with no contributions', () => {
    expect(savedPaise([])).toBe(0);
  });
});

describe('progress', () => {
  it('reports the fraction and percentage saved', () => {
    expect(progressFraction(TARGET, 12500000)).toBe(0.25);
    expect(progressPercentage(TARGET, 12500000)).toBe(25);
  });

  it('clamps at full for an over-funded goal', () => {
    expect(progressFraction(TARGET, TARGET * 2)).toBe(1);
    expect(progressPercentage(TARGET, TARGET * 2)).toBe(100);
  });

  it('never divides by a zero target', () => {
    expect(progressFraction(0, 100)).toBe(0);
  });

  it('reports what is left, never negative', () => {
    expect(remainingPaise(TARGET, 12500000)).toBe(37500000);
    expect(remainingPaise(TARGET, TARGET * 2)).toBe(0);
  });

  it('knows when a goal is met', () => {
    expect(isComplete(TARGET, TARGET)).toBe(true);
    expect(isComplete(TARGET, TARGET - 1)).toBe(false);
    expect(isComplete(0, 0)).toBe(false);
  });
});

describe('monthsUntil', () => {
  it('counts whole months ahead, including the current one', () => {
    expect(monthsUntil(new Date(2026, 11, 19), NOW)).toBe(4);
  });

  it('counts a target later this month as one month', () => {
    expect(monthsUntil(new Date(2026, 8, 25), NOW)).toBe(1);
  });

  it('never returns zero, so a division cannot blow up', () => {
    expect(monthsUntil(new Date(2026, 8, 1), NOW)).toBe(1);
    expect(monthsUntil(new Date(2025, 0, 1), NOW)).toBe(1);
  });

  it('crosses a year boundary', () => {
    expect(monthsUntil(new Date(2027, 2, 19), NOW)).toBe(7);
  });
});

describe('requiredMonthlyPaise', () => {
  it('divides what is left by the months remaining', () => {
    // From 19 Sep 2026 to a 1 Sep 2027 target there are twelve monthly
    // contributions that land before the deadline - September through August.
    const months = monthsUntil(new Date(2027, 8, 1), NOW);
    expect(months).toBe(12);
    expect(requiredMonthlyPaise(goal(), 0, NOW)).toBe(Math.ceil(TARGET / months));
  });

  it('saves enough to actually reach the target by the date', () => {
    const required = requiredMonthlyPaise(goal(), 0, NOW)!;
    const months = monthsUntil(new Date(2027, 8, 1), NOW);

    expect(required * months).toBeGreaterThanOrEqual(TARGET);
  });

  it('shrinks as contributions land', () => {
    const early = requiredMonthlyPaise(goal(), 0, NOW)!;
    const later = requiredMonthlyPaise(goal(), 20000000, NOW)!;

    expect(later).toBeLessThan(early);
  });

  it('is zero once the goal is funded', () => {
    expect(requiredMonthlyPaise(goal(), TARGET, NOW)).toBe(0);
  });

  it('is null without a target date - there is nothing to divide by', () => {
    expect(requiredMonthlyPaise(goal({ target_date: null }), 0, NOW)).toBeNull();
  });

  it('owes the whole remainder when the date has already passed', () => {
    const past = goal({ target_date: new Date(2026, 5, 1).toISOString() });
    expect(requiredMonthlyPaise(past, 10000000, NOW)).toBe(40000000);
  });

  it('rounds up, so the target is actually met rather than just missed', () => {
    const tenMonths = goal({ target_date: new Date(2027, 5, 19).toISOString() });
    const required = requiredMonthlyPaise({ ...tenMonths, target_paise: 1001 }, 0, NOW)!;

    expect(required * monthsUntil(new Date(2027, 5, 19), NOW)).toBeGreaterThanOrEqual(1001);
  });

  it('ignores an unparseable date rather than producing nonsense', () => {
    expect(requiredMonthlyPaise(goal({ target_date: 'not a date' }), 0, NOW)).toBeNull();
  });
});

describe('averageMonthlyPaise', () => {
  it('averages from the first contribution, not the goal creation', () => {
    // Two contributions, July and August; September is the third month.
    const rate = averageMonthlyPaise(
      [contribution(3000000, new Date(2026, 6, 1)), contribution(3000000, new Date(2026, 7, 1))],
      NOW,
    );

    expect(rate).toBe(2000000);
  });

  it('counts a single contribution this month as one month of saving', () => {
    expect(averageMonthlyPaise([contribution(1000000, new Date(2026, 8, 5))], NOW)).toBe(1000000);
  });

  it('is null with no contributions - there is no rate to report', () => {
    expect(averageMonthlyPaise([], NOW)).toBeNull();
  });

  it('ignores deleted contributions', () => {
    expect(
      averageMonthlyPaise([contribution(9999999, new Date(2026, 8, 1), true)], NOW),
    ).toBeNull();
  });

  it('returns whole paise', () => {
    const rate = averageMonthlyPaise([contribution(1001, new Date(2026, 6, 1))], NOW)!;
    expect(Number.isInteger(rate)).toBe(true);
  });
});

describe('projectCompletion', () => {
  it('projects from the rate so far', () => {
    // ₹30,000 saved over 3 months is ₹10,000 a month; ₹4,70,000 to go is 47
    // more months.
    const projection = projectCompletion(
      goal(),
      [contribution(1000000, new Date(2026, 6, 1)), contribution(2000000, new Date(2026, 7, 1))],
      NOW,
    )!;

    expect(projection.monthsRemaining).toBe(47);
    expect(projection.date.getFullYear()).toBe(2030);
  });

  it('flags a projection that lands after the target date', () => {
    const projection = projectCompletion(
      goal(),
      [contribution(1000000, new Date(2026, 8, 1))],
      NOW,
    )!;

    expect(projection.behindTarget).toBe(true);
  });

  it('does not flag a projection that beats the target date', () => {
    const projection = projectCompletion(
      goal({ target_date: new Date(2030, 0, 1).toISOString() }),
      [contribution(25000000, new Date(2026, 8, 1))],
      NOW,
    )!;

    expect(projection.behindTarget).toBe(false);
  });

  it('is null when there is nothing to project from, rather than guessing', () => {
    expect(projectCompletion(goal(), [], NOW)).toBeNull();
  });

  it('is immediate for a goal already met', () => {
    const projection = projectCompletion(
      goal(),
      [contribution(TARGET, new Date(2026, 8, 1))],
      NOW,
    )!;

    expect(projection.monthsRemaining).toBe(0);
    expect(projection.behindTarget).toBe(false);
  });

  it('handles a goal with no target date', () => {
    const projection = projectCompletion(
      goal({ target_date: null }),
      [contribution(5000000, new Date(2026, 8, 1))],
      NOW,
    )!;

    expect(projection.behindTarget).toBe(false);
    expect(projection.monthsRemaining).toBeGreaterThan(0);
  });
});

describe('summariseGoal', () => {
  it('answers every question a goal card asks', () => {
    const summary = summariseGoal(
      goal(),
      [contribution(5000000, new Date(2026, 7, 1)), contribution(5000000, new Date(2026, 8, 1))],
      NOW,
    );

    expect(summary.savedPaise).toBe(10000000);
    expect(summary.remainingPaise).toBe(40000000);
    expect(summary.progressPercentage).toBe(20);
    expect(summary.isComplete).toBe(false);
    expect(summary.requiredMonthlyPaise).toBeGreaterThan(0);
    expect(summary.averageMonthlyPaise).toBe(5000000);
    expect(summary.projection).not.toBeNull();
  });

  it('reports a completed goal as complete', () => {
    const summary = summariseGoal(goal(), [contribution(TARGET, new Date(2026, 8, 1))], NOW);

    expect(summary.isComplete).toBe(true);
    expect(summary.progressPercentage).toBe(100);
    expect(summary.requiredMonthlyPaise).toBe(0);
  });

  it('is honest about a goal with no contributions', () => {
    const summary = summariseGoal(goal(), [], NOW);

    expect(summary.savedPaise).toBe(0);
    expect(summary.averageMonthlyPaise).toBeNull();
    expect(summary.projection).toBeNull();
  });
});

describe('formatProjectionDate', () => {
  it('names the month and year', () => {
    const label = formatProjectionDate(new Date(2027, 2, 1));
    expect(label).toContain('March');
    expect(label).toContain('2027');
  });
});
