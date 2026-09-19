import {
  MoneyError,
  assertPaise,
  formatPaise,
  isPaise,
  paiseToRupees,
  parseAmountToPaise,
  percentageOfPaise,
  rupeesToPaise,
  splitPaise,
  sumPaise,
} from '@/utils/money';

describe('isPaise / assertPaise', () => {
  it('accepts safe integers', () => {
    expect(isPaise(0)).toBe(true);
    expect(isPaise(-12345)).toBe(true);
    expect(assertPaise(99)).toBe(99);
  });

  it('rejects floats and non-finite values', () => {
    expect(isPaise(10.5)).toBe(false);
    expect(isPaise(Number.NaN)).toBe(false);
    expect(() => assertPaise(10.5)).toThrow(MoneyError);
  });
});

describe('rupeesToPaise', () => {
  it.each([
    [0, 0],
    [1, 100],
    [1.5, 150],
    [1234.56, 123456],
    [-99.99, -9999],
  ])('converts %p rupees to %p paise', (rupees, expected) => {
    expect(rupeesToPaise(rupees)).toBe(expected);
  });

  it('rounds half away from zero instead of trusting float maths', () => {
    expect(rupeesToPaise(0.005)).toBe(1);
    expect(rupeesToPaise(-0.005)).toBe(-1);
    // 0.1 + 0.2 is famously 0.30000000000000004 in floating point.
    expect(rupeesToPaise(0.1 + 0.2)).toBe(30);
  });

  it('throws on non-finite input', () => {
    expect(() => rupeesToPaise(Number.POSITIVE_INFINITY)).toThrow(MoneyError);
  });
});

describe('paiseToRupees', () => {
  it('is the inverse of rupeesToPaise for representable amounts', () => {
    expect(paiseToRupees(123456)).toBeCloseTo(1234.56, 2);
  });
});

describe('parseAmountToPaise', () => {
  it.each([
    ['1234.50', 123450],
    ['₹1,234.50', 123450],
    ['  250 ', 25000],
    ['-90', -9000],
    ['.5', 50],
  ])('parses %p', (input, expected) => {
    expect(parseAmountToPaise(input)).toBe(expected);
  });

  it.each(['', '-', 'abc', '12.3.4', '₹'])('returns null for %p', (input) => {
    expect(parseAmountToPaise(input)).toBeNull();
  });
});

describe('formatPaise', () => {
  it('formats using the Indian numbering system', () => {
    // Intl inserts a non-breaking space in some environments; normalise it.
    const formatted = formatPaise(12345678).replace(/ /g, ' ');
    expect(formatted).toContain('₹');
    expect(formatted).toContain('1,23,456.78');
  });

  it('can drop the symbol and the decimals', () => {
    expect(formatPaise(150000, { withSymbol: false, withDecimals: false })).toBe('1,500');
  });

  it('can always show the sign', () => {
    expect(formatPaise(100, { signDisplay: 'always' })).toContain('+');
  });

  it('rejects float input', () => {
    expect(() => formatPaise(10.5)).toThrow(MoneyError);
  });
});

describe('sumPaise', () => {
  it('sums without float drift', () => {
    expect(sumPaise([10, 20, 30])).toBe(60);
    expect(sumPaise([])).toBe(0);
  });

  it('rejects a float in the list', () => {
    expect(() => sumPaise([10, 0.5])).toThrow(MoneyError);
  });
});

describe('splitPaise', () => {
  it('distributes the remainder so the parts add back up', () => {
    const parts = splitPaise(1000, 3);
    expect(parts).toEqual([334, 333, 333]);
    expect(sumPaise(parts)).toBe(1000);
  });

  it('handles negative amounts', () => {
    const parts = splitPaise(-1000, 3);
    expect(sumPaise(parts)).toBe(-1000);
  });

  it('rejects a non-positive part count', () => {
    expect(() => splitPaise(100, 0)).toThrow(MoneyError);
  });
});

describe('percentageOfPaise', () => {
  it('computes a rounded percentage', () => {
    expect(percentageOfPaise(2500, 10000)).toBe(25);
    expect(percentageOfPaise(1, 3, 2)).toBe(33.33);
  });

  it('returns 0 when the whole is 0 rather than dividing by zero', () => {
    expect(percentageOfPaise(500, 0)).toBe(0);
  });
});
