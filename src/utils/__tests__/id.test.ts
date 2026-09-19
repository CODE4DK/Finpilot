import { createId, isUuid } from '@/utils/id';

describe('createId', () => {
  it('returns a v4 UUID', () => {
    expect(isUuid(createId())).toBe(true);
  });

  it('returns a different id each time', () => {
    const ids = new Set(Array.from({ length: 50 }, () => createId()));
    expect(ids.size).toBe(50);
  });
});

describe('isUuid', () => {
  it('rejects malformed ids', () => {
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid('')).toBe(false);
  });
});
