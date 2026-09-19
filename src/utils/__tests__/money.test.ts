import {
  MoneyError,
  absPaise,
  addPaise,
  assertPaise,
  clampPaise,
  comparePaise,
  formatCompactINR,
  formatINR,
  formatPaise,
  groupIndianDigits,
  isNegative,
  isZero,
  multiplyPaise,
  negatePaise,
  scalePaise,
  subtractPaise,
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

describe('formatPaise / formatINR', () => {
  it('groups digits the Indian way', () => {
    expect(formatINR(100000_00)).toBe('₹1,00,000.00');
    expect(formatINR(1234567890)).toBe('₹1,23,45,678.90');
    expect(formatINR(10000000000)).toBe('₹10,00,00,000.00');
  });

  it('formats small amounts without grouping', () => {
    expect(formatINR(0)).toBe('₹0.00');
    expect(formatINR(5)).toBe('₹0.05');
    expect(formatINR(99)).toBe('₹0.99');
    expect(formatINR(100)).toBe('₹1.00');
    expect(formatINR(99999)).toBe('₹999.99');
  });

  it('pads the paise component', () => {
    expect(formatINR(1005)).toBe('₹10.05');
    expect(formatINR(1050)).toBe('₹10.50');
  });

  it('places the minus sign before the symbol', () => {
    expect(formatINR(-123456)).toBe('-₹1,234.56');
  });

  it('can drop the symbol and the decimals', () => {
    expect(formatINR(150000, { withSymbol: false, withDecimals: false })).toBe('1,500');
  });

  it('can always show the sign', () => {
    expect(formatINR(100, { signDisplay: 'always' })).toBe('+₹1.00');
    expect(formatINR(0, { signDisplay: 'always' })).toBe('+₹0.00');
  });

  it('formatPaise is the same function by another name', () => {
    expect(formatPaise(100000_00)).toBe(formatINR(100000_00));
  });

  it('rejects float input', () => {
    expect(() => formatINR(10.5)).toThrow(MoneyError);
  });
});

describe('groupIndianDigits', () => {
  it.each([
    ['1', '1'],
    ['999', '999'],
    ['1000', '1,000'],
    ['99999', '99,999'],
    ['100000', '1,00,000'],
    ['12345678', '1,23,45,678'],
    ['1000000000', '1,00,00,00,000'],
  ])('groups %p as %p', (input, expected) => {
    expect(groupIndianDigits(input)).toBe(expected);
  });
});

describe('formatCompactINR', () => {
  it.each([
    [999_00, '₹999'],
    [1_000_00, '₹1K'],
    [12_500_00, '₹12.5K'],
    [1_00_000_00, '₹1L'],
    [1_25_000_00, '₹1.25L'],
    [1_00_00_000_00, '₹1Cr'],
    [2_40_00_000_00, '₹2.4Cr'],
  ])('renders %p paise as %p', (paise, expected) => {
    expect(formatCompactINR(paise)).toBe(expected);
  });

  it('keeps the sign', () => {
    expect(formatCompactINR(-1_25_000_00)).toBe('-₹1.25L');
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

describe('safe arithmetic', () => {
  it('adds and subtracts without float drift', () => {
    expect(addPaise(1050, 2075)).toBe(3125);
    expect(subtractPaise(1050, 2075)).toBe(-1025);
    // The classic float trap, in paise: 0.1 + 0.2 must be exactly 0.30.
    expect(addPaise(rupeesToPaise(0.1), rupeesToPaise(0.2))).toBe(30);
  });

  it('multiplies by a whole count only', () => {
    expect(multiplyPaise(2500, 3)).toBe(7500);
    expect(() => multiplyPaise(2500, 1.5)).toThrow(MoneyError);
  });

  it('scales by a rate and rounds half away from zero', () => {
    expect(scalePaise(10000, 0.18)).toBe(1800);
    expect(scalePaise(101, 0.5)).toBe(51);
    expect(scalePaise(-101, 0.5)).toBe(-51);
    expect(() => scalePaise(100, Number.NaN)).toThrow(MoneyError);
  });

  it('negates, absolutises and compares', () => {
    expect(negatePaise(500)).toBe(-500);
    expect(negatePaise(0)).toBe(0);
    expect(absPaise(-500)).toBe(500);
    expect(comparePaise(100, 200)).toBe(-1);
    expect(comparePaise(200, 100)).toBe(1);
    expect(comparePaise(100, 100)).toBe(0);
  });

  it('clamps within a range', () => {
    expect(clampPaise(150, 0, 100)).toBe(100);
    expect(clampPaise(-150, 0, 100)).toBe(0);
    expect(clampPaise(50, 0, 100)).toBe(50);
    expect(() => clampPaise(50, 100, 0)).toThrow(MoneyError);
  });

  it('answers the boolean questions', () => {
    expect(isZero(0)).toBe(true);
    expect(isZero(1)).toBe(false);
    expect(isNegative(-1)).toBe(true);
    expect(isNegative(0)).toBe(false);
  });

  it('rejects floats everywhere', () => {
    expect(() => addPaise(1.5, 1)).toThrow(MoneyError);
    expect(() => subtractPaise(1, 1.5)).toThrow(MoneyError);
    expect(() => negatePaise(1.5)).toThrow(MoneyError);
    expect(() => absPaise(1.5)).toThrow(MoneyError);
    expect(() => comparePaise(1.5, 1)).toThrow(MoneyError);
  });

  it('refuses to produce an unsafe integer', () => {
    expect(() => addPaise(Number.MAX_SAFE_INTEGER, 1)).toThrow(MoneyError);
  });
});
