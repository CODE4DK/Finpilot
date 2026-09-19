import {
  fromBoolean,
  fromJson,
  nowIso,
  toBoolean,
  toDate,
  toJson,
  toOptionalDate,
  toPaise,
} from '@/db/row-mappers';

describe('booleans', () => {
  it('reads SQLite integers', () => {
    expect(toBoolean(1)).toBe(true);
    expect(toBoolean(0)).toBe(false);
  });

  it('treats null and undefined as false', () => {
    expect(toBoolean(null)).toBe(false);
    expect(toBoolean(undefined)).toBe(false);
  });

  it('passes real booleans straight through', () => {
    expect(toBoolean(true)).toBe(true);
    expect(toBoolean(false)).toBe(false);
  });

  it('writes integers', () => {
    expect(fromBoolean(true)).toBe(1);
    expect(fromBoolean(false)).toBe(0);
  });

  it('round-trips', () => {
    expect(toBoolean(fromBoolean(true))).toBe(true);
    expect(toBoolean(fromBoolean(false))).toBe(false);
  });
});

describe('dates', () => {
  it('parses an ISO timestamp', () => {
    expect(toOptionalDate('2026-09-19T10:30:00.000Z')?.toISOString()).toBe(
      '2026-09-19T10:30:00.000Z',
    );
  });

  it('returns null for missing or unparseable values', () => {
    expect(toOptionalDate(null)).toBeNull();
    expect(toOptionalDate('')).toBeNull();
    expect(toOptionalDate('not a date')).toBeNull();
  });

  it('falls back rather than returning Invalid Date', () => {
    const fallback = new Date('2026-01-01T00:00:00.000Z');
    expect(toDate('rubbish', fallback)).toBe(fallback);
    expect(toDate('2026-09-19T10:30:00.000Z', fallback).toISOString()).toBe(
      '2026-09-19T10:30:00.000Z',
    );
  });

  it('formats as ISO-8601 UTC', () => {
    expect(nowIso(new Date(Date.UTC(2026, 8, 19, 10, 30)))).toBe('2026-09-19T10:30:00.000Z');
  });
});

describe('json columns', () => {
  it('parses an object', () => {
    expect(toJson('{"spend":100}', {})).toEqual({ spend: 100 });
  });

  it('falls back on null, empty or malformed text rather than throwing', () => {
    expect(toJson(null, { ok: true })).toEqual({ ok: true });
    expect(toJson('', { ok: true })).toEqual({ ok: true });
    expect(toJson('{not json', { ok: true })).toEqual({ ok: true });
  });

  it('serialises, treating null as an empty object', () => {
    expect(fromJson({ a: 1 })).toBe('{"a":1}');
    expect(fromJson(null)).toBe('{}');
    expect(fromJson(undefined)).toBe('{}');
  });
});

describe('money columns', () => {
  it('passes integers through', () => {
    expect(toPaise(184550)).toBe(184550);
    expect(toPaise(-500)).toBe(-500);
    expect(toPaise(0)).toBe(0);
  });

  it('never lets a float or a null reach a balance', () => {
    expect(toPaise(10.7)).toBe(10);
    expect(toPaise(null)).toBe(0);
    expect(toPaise(undefined)).toBe(0);
    expect(toPaise(Number.NaN)).toBe(0);
    expect(toPaise(Number.POSITIVE_INFINITY)).toBe(0);
  });
});
