import {
  MAX_CATCH_UP_OCCURRENCES,
  advance,
  anchorDayOf,
  clampToMonth,
  daysInMonth,
  describeRecurrence,
  occurrencesUpTo,
  ordinal,
} from '@/features/recurring/schedule';

/** "2026-09-19" for readable assertions. */
function key(date: Date): string {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;
}

describe('daysInMonth', () => {
  it.each([
    [2026, 0, 31],
    [2026, 1, 28],
    [2024, 1, 29],
    [2000, 1, 29],
    [1900, 1, 28],
    [2026, 3, 30],
    [2026, 11, 31],
  ])('%d month %d has %d days', (year, month, expected) => {
    expect(daysInMonth(year, month)).toBe(expected);
  });
});

describe('advance: daily and weekly', () => {
  it('adds a day', () => {
    expect(key(advance(new Date(2026, 8, 19), { frequency: 'daily' }))).toBe('2026-09-20');
  });

  it('adds several days across a month boundary', () => {
    expect(key(advance(new Date(2026, 8, 28), { frequency: 'daily', interval: 5 }))).toBe(
      '2026-10-03',
    );
  });

  it('adds a week', () => {
    expect(key(advance(new Date(2026, 8, 19), { frequency: 'weekly' }))).toBe('2026-09-26');
  });

  it('supports a fortnight', () => {
    expect(key(advance(new Date(2026, 8, 19), { frequency: 'weekly', interval: 2 }))).toBe(
      '2026-10-03',
    );
  });

  it('keeps the time of day', () => {
    const next = advance(new Date(2026, 8, 19, 9, 30, 15, 250), { frequency: 'daily' });
    expect([next.getHours(), next.getMinutes(), next.getSeconds()]).toEqual([9, 30, 15]);
  });

  it('rejects a non-positive interval', () => {
    expect(() => advance(new Date(), { frequency: 'daily', interval: 0 })).toThrow();
    expect(() => advance(new Date(), { frequency: 'daily', interval: -1 })).toThrow();
    expect(() => advance(new Date(), { frequency: 'daily', interval: 1.5 })).toThrow();
  });
});

describe('advance: monthly on a safe day', () => {
  it('keeps the same day', () => {
    expect(key(advance(new Date(2026, 0, 15), { frequency: 'monthly' }))).toBe('2026-02-15');
  });

  it('crosses the year boundary', () => {
    expect(key(advance(new Date(2026, 11, 15), { frequency: 'monthly' }))).toBe('2027-01-15');
  });

  it('supports a quarterly interval', () => {
    expect(key(advance(new Date(2026, 0, 15), { frequency: 'monthly', interval: 3 }))).toBe(
      '2026-04-15',
    );
  });
});

describe('advance: monthly on the 29th, 30th and 31st', () => {
  it('clamps 31 January to the end of February', () => {
    expect(key(advance(new Date(2026, 0, 31), { frequency: 'monthly' }))).toBe('2026-02-28');
  });

  it('clamps to 29 February in a leap year', () => {
    expect(key(advance(new Date(2024, 0, 31), { frequency: 'monthly' }))).toBe('2024-02-29');
  });

  it('returns to the 31st after a short month, rather than drifting', () => {
    // The anchor is what makes this work: from 28 Feb, a naive +1 month would
    // give 28 Mar and stay there forever.
    const march = advance(new Date(2026, 1, 28), { frequency: 'monthly', anchorDay: 31 });
    expect(key(march)).toBe('2026-03-31');
  });

  it('runs a full year anchored on the 31st without drifting', () => {
    let cursor = new Date(2026, 0, 31);
    const days: string[] = [key(cursor)];

    for (let month = 0; month < 11; month += 1) {
      cursor = advance(cursor, { frequency: 'monthly', anchorDay: 31 });
      days.push(key(cursor));
    }

    expect(days).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
      '2026-06-30',
      '2026-07-31',
      '2026-08-31',
      '2026-09-30',
      '2026-10-31',
      '2026-11-30',
      '2026-12-31',
    ]);
  });

  it('runs a year anchored on the 30th', () => {
    let cursor = new Date(2026, 0, 30);
    const days: string[] = [key(cursor)];

    for (let month = 0; month < 3; month += 1) {
      cursor = advance(cursor, { frequency: 'monthly', anchorDay: 30 });
      days.push(key(cursor));
    }

    expect(days).toEqual(['2026-01-30', '2026-02-28', '2026-03-30', '2026-04-30']);
  });

  it('runs a year anchored on the 29th, landing on 29 February in a leap year', () => {
    let cursor = new Date(2024, 0, 29);
    const days: string[] = [key(cursor)];

    for (let month = 0; month < 2; month += 1) {
      cursor = advance(cursor, { frequency: 'monthly', anchorDay: 29 });
      days.push(key(cursor));
    }

    expect(days).toEqual(['2024-01-29', '2024-02-29', '2024-03-29']);
  });

  it('never rolls into the following month', () => {
    for (let month = 0; month < 12; month += 1) {
      const next = advance(new Date(2026, month, 1), { frequency: 'monthly', anchorDay: 31 });
      expect(next.getMonth()).toBe((month + 1) % 12);
    }
  });
});

describe('advance: yearly', () => {
  it('adds a year', () => {
    expect(key(advance(new Date(2026, 8, 19), { frequency: 'yearly' }))).toBe('2027-09-19');
  });

  it('clamps 29 February to the 28th in a common year', () => {
    expect(key(advance(new Date(2024, 1, 29), { frequency: 'yearly' }))).toBe('2025-02-28');
  });

  it('returns to 29 February at the next leap year', () => {
    let cursor = new Date(2024, 1, 29);
    const days = [key(cursor)];
    for (let year = 0; year < 4; year += 1) {
      cursor = advance(cursor, { frequency: 'yearly', anchorDay: 29 });
      days.push(key(cursor));
    }

    expect(days).toEqual(['2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29']);
  });
});

describe('clampToMonth and anchorDayOf', () => {
  it('clamps to the last day of a short month', () => {
    expect(key(clampToMonth(2026, 1, 31, new Date(2026, 0, 31)))).toBe('2026-02-28');
  });

  it('leaves a safe day alone', () => {
    expect(key(clampToMonth(2026, 1, 15, new Date(2026, 0, 15)))).toBe('2026-02-15');
  });

  it('reads the anchor off a date', () => {
    expect(anchorDayOf(new Date(2026, 0, 31))).toBe(31);
  });
});

describe('occurrencesUpTo', () => {
  it('returns nothing when the first occurrence is still in the future', () => {
    const result = occurrencesUpTo({
      from: new Date(2026, 8, 25),
      until: new Date(2026, 8, 19),
      frequency: 'monthly',
    });

    expect(result.occurrences).toEqual([]);
    expect(key(result.nextRunAt!)).toBe('2026-09-25');
  });

  it('catches up every missed occurrence', () => {
    const result = occurrencesUpTo({
      from: new Date(2026, 5, 1),
      until: new Date(2026, 8, 19),
      frequency: 'monthly',
    });

    expect(result.occurrences.map(key)).toEqual([
      '2026-06-01',
      '2026-07-01',
      '2026-08-01',
      '2026-09-01',
    ]);
    expect(key(result.nextRunAt!)).toBe('2026-10-01');
  });

  it('includes an occurrence falling exactly on the cutoff', () => {
    const result = occurrencesUpTo({
      from: new Date(2026, 8, 19, 9, 0),
      until: new Date(2026, 8, 19, 9, 0),
      frequency: 'daily',
    });

    expect(result.occurrences).toHaveLength(1);
  });

  it('stops at the rule end date and clears next_run_at', () => {
    const result = occurrencesUpTo({
      from: new Date(2026, 5, 1),
      until: new Date(2026, 8, 19),
      endAt: new Date(2026, 6, 15),
      frequency: 'monthly',
    });

    expect(result.occurrences.map(key)).toEqual(['2026-06-01', '2026-07-01']);
    expect(result.nextRunAt).toBeNull();
  });

  it('clears next_run_at when the following occurrence is past the end date', () => {
    const result = occurrencesUpTo({
      from: new Date(2026, 8, 1),
      until: new Date(2026, 8, 19),
      endAt: new Date(2026, 8, 20),
      frequency: 'monthly',
    });

    expect(result.occurrences.map(key)).toEqual(['2026-09-01']);
    expect(result.nextRunAt).toBeNull();
  });

  it('caps a rule abandoned for years rather than hanging the launch', () => {
    const result = occurrencesUpTo({
      from: new Date(2000, 0, 1),
      until: new Date(2026, 8, 19),
      frequency: 'daily',
    });

    expect(result.truncated).toBe(true);
    expect(result.occurrences).toHaveLength(MAX_CATCH_UP_OCCURRENCES);
    // The next run is past the last generated one, so the next launch picks up
    // where this one stopped instead of repeating it.
    expect(result.nextRunAt!.getTime()).toBeGreaterThan(result.occurrences.at(-1)!.getTime());
  });

  it('honours a custom cap', () => {
    const result = occurrencesUpTo({
      from: new Date(2026, 8, 1),
      until: new Date(2026, 8, 19),
      frequency: 'daily',
      max: 5,
    });

    expect(result.occurrences).toHaveLength(5);
    expect(result.truncated).toBe(true);
  });

  it('keeps the anchor across a catch-up spanning short months', () => {
    const result = occurrencesUpTo({
      from: new Date(2026, 0, 31),
      until: new Date(2026, 3, 15),
      frequency: 'monthly',
      anchorDay: 31,
    });

    expect(result.occurrences.map(key)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
    expect(key(result.nextRunAt!)).toBe('2026-04-30');
  });
});

describe('describeRecurrence', () => {
  it.each([
    ['daily', 1, undefined, 'Every day'],
    ['daily', 3, undefined, 'Every 3 days'],
    ['weekly', 1, undefined, 'Every week'],
    ['weekly', 2, undefined, 'Every 2 weeks'],
    ['monthly', 1, undefined, 'Every month'],
    ['monthly', 1, 31, 'Every month on the 31st'],
    ['monthly', 3, 1, 'Every 3 months on the 1st'],
    ['yearly', 1, undefined, 'Every year'],
  ] as const)('describes %s/%d as %s', (frequency, interval, anchorDay, expected) => {
    expect(describeRecurrence(frequency, interval, anchorDay)).toBe(expected);
  });
});

describe('ordinal', () => {
  it.each([
    [1, '1st'],
    [2, '2nd'],
    [3, '3rd'],
    [4, '4th'],
    [11, '11th'],
    [12, '12th'],
    [13, '13th'],
    [21, '21st'],
    [22, '22nd'],
    [23, '23rd'],
    [31, '31st'],
  ])('renders %d as %s', (day, expected) => {
    expect(ordinal(day)).toBe(expected);
  });
});
