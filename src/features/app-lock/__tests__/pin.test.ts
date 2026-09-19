import {
  MAX_PIN_ATTEMPTS,
  PIN_HASH_ITERATIONS,
  PIN_LENGTH,
  PinError,
  assertValidPin,
  createPinRecord,
  derivePinHash,
  generateSalt,
  isValidPin,
  nextAttemptState,
  safeEqual,
  verifyPin,
} from '@/features/app-lock/pin';

// A small iteration count keeps the suite fast; the algorithm is identical.
const FAST = 5;

describe('isValidPin / assertValidPin', () => {
  it.each(['0000', '1234', '9999'])('accepts %p', (pin) => {
    expect(isValidPin(pin)).toBe(true);
    expect(assertValidPin(pin)).toBe(pin);
  });

  it.each(['', '123', '12345', 'abcd', '12 4', '12.4', '-123', '１２３４'])('rejects %p', (pin) => {
    expect(isValidPin(pin)).toBe(false);
    expect(() => assertValidPin(pin)).toThrow(PinError);
  });

  it('is exactly four digits', () => {
    expect(PIN_LENGTH).toBe(4);
  });
});

describe('generateSalt', () => {
  it('returns hex of the requested length', () => {
    expect(generateSalt(16)).toMatch(/^[0-9a-f]{32}$/);
    expect(generateSalt(8)).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is different every time', () => {
    const salts = new Set(Array.from({ length: 50 }, () => generateSalt()));
    expect(salts.size).toBe(50);
  });
});

describe('derivePinHash', () => {
  it('is deterministic for the same pin, salt and iterations', async () => {
    const salt = generateSalt();
    await expect(derivePinHash('1234', salt, FAST)).resolves.toBe(
      await derivePinHash('1234', salt, FAST),
    );
  });

  it('differs for a different pin', async () => {
    const salt = generateSalt();
    expect(await derivePinHash('1234', salt, FAST)).not.toBe(
      await derivePinHash('1235', salt, FAST),
    );
  });

  it('differs for the same pin under a different salt', async () => {
    expect(await derivePinHash('1234', generateSalt(), FAST)).not.toBe(
      await derivePinHash('1234', generateSalt(), FAST),
    );
  });

  it('differs when the iteration count changes', async () => {
    const salt = generateSalt();
    expect(await derivePinHash('1234', salt, 1)).not.toBe(await derivePinHash('1234', salt, 2));
  });

  it('never returns the PIN itself', async () => {
    const hash = await derivePinHash('1234', generateSalt(), FAST);
    expect(hash).not.toContain('1234');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects an invalid pin or iteration count', async () => {
    await expect(derivePinHash('12', generateSalt(), FAST)).rejects.toThrow(PinError);
    await expect(derivePinHash('1234', generateSalt(), 0)).rejects.toThrow(PinError);
    await expect(derivePinHash('1234', generateSalt(), 1.5)).rejects.toThrow(PinError);
  });
});

describe('createPinRecord', () => {
  it('stores a salt, a digest and the iteration count - never the PIN', async () => {
    const record = await createPinRecord('1234', FAST);

    expect(record.salt).toMatch(/^[0-9a-f]{32}$/);
    expect(record.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(record.iterations).toBe(FAST);
    expect(record.version).toBe(1);
    expect(JSON.stringify(record)).not.toContain('1234');
  });

  it('salts each record separately, so two users with the same PIN differ', async () => {
    const first = await createPinRecord('1234', FAST);
    const second = await createPinRecord('1234', FAST);

    expect(first.salt).not.toBe(second.salt);
    expect(first.hash).not.toBe(second.hash);
  });

  it('defaults to the production iteration count', async () => {
    const record = await createPinRecord('1234', PIN_HASH_ITERATIONS);
    expect(record.iterations).toBe(PIN_HASH_ITERATIONS);
  });
});

describe('verifyPin', () => {
  it('accepts the right PIN', async () => {
    const record = await createPinRecord('4821', FAST);
    await expect(verifyPin('4821', record)).resolves.toBe(true);
  });

  it('rejects the wrong PIN', async () => {
    const record = await createPinRecord('4821', FAST);
    await expect(verifyPin('4822', record)).resolves.toBe(false);
    await expect(verifyPin('1284', record)).resolves.toBe(false);
  });

  it('rejects malformed input without throwing', async () => {
    const record = await createPinRecord('4821', FAST);
    await expect(verifyPin('', record)).resolves.toBe(false);
    await expect(verifyPin('482', record)).resolves.toBe(false);
    await expect(verifyPin('abcd', record)).resolves.toBe(false);
  });

  it('rejects a record whose salt has been tampered with', async () => {
    const record = await createPinRecord('4821', FAST);
    await expect(verifyPin('4821', { ...record, salt: generateSalt() })).resolves.toBe(false);
  });

  it('verifies against the iteration count stored in the record', async () => {
    const record = await createPinRecord('4821', 3);
    await expect(verifyPin('4821', record)).resolves.toBe(true);
    await expect(verifyPin('4821', { ...record, iterations: 4 })).resolves.toBe(false);
  });
});

describe('safeEqual', () => {
  it('compares equal strings', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
  });

  it('rejects different strings and different lengths', () => {
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'ab')).toBe(false);
    expect(safeEqual('', 'a')).toBe(false);
  });

  it('treats two empty strings as equal', () => {
    expect(safeEqual('', '')).toBe(true);
  });
});

describe('nextAttemptState', () => {
  it('counts failures up to the lockout', () => {
    let state = nextAttemptState(0, false);
    expect(state).toEqual({
      failedAttempts: 1,
      lockedOut: false,
      remainingAttempts: MAX_PIN_ATTEMPTS - 1,
    });

    for (let attempt = 1; attempt < MAX_PIN_ATTEMPTS; attempt += 1) {
      state = nextAttemptState(state.failedAttempts, false);
    }

    expect(state.lockedOut).toBe(true);
    expect(state.remainingAttempts).toBe(0);
  });

  it('resets the count on success', () => {
    expect(nextAttemptState(4, true)).toEqual({
      failedAttempts: 0,
      lockedOut: false,
      remainingAttempts: MAX_PIN_ATTEMPTS,
    });
  });

  it('never reports negative remaining attempts', () => {
    expect(nextAttemptState(MAX_PIN_ATTEMPTS + 3, false).remainingAttempts).toBe(0);
  });
});
