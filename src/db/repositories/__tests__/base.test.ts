import { AccountsRepository } from '@/db/repositories/accounts';
import { buildInsert, buildUpdate } from '@/db/repositories/base';
import { createMockDatabase, type MockDatabase } from '@/test-utils/mock-database';
import { isUuid } from '@/utils/id';

const USER_ID = 'a1111111-1111-4111-8111-111111111111';
const FIXED_NOW = new Date('2026-09-19T10:30:00.000Z');

describe('buildInsert', () => {
  it('builds a parameterised insert', () => {
    expect(buildInsert('accounts', { id: '1', name: 'HDFC' })).toEqual({
      sql: 'INSERT INTO accounts (id, name) VALUES (?, ?)',
      parameters: ['1', 'HDFC'],
    });
  });

  it('never inlines a value into the SQL', () => {
    const { sql, parameters } = buildInsert('accounts', { name: "Robert'); DROP TABLE --" });
    expect(sql).not.toContain('DROP');
    expect(parameters).toEqual(["Robert'); DROP TABLE --"]);
  });
});

describe('buildUpdate', () => {
  it('scopes the update to the row and its owner', () => {
    expect(buildUpdate('accounts', 'row-1', USER_ID, { name: 'New' })).toEqual({
      sql: 'UPDATE accounts SET name = ? WHERE id = ? AND user_id = ?',
      parameters: ['New', 'row-1', USER_ID],
    });
  });

  it('refuses an empty update rather than writing a broken statement', () => {
    expect(() => buildUpdate('accounts', 'row-1', USER_ID, {})).toThrow();
  });
});

describe('BaseRepository writes', () => {
  let db: MockDatabase;
  let repo: AccountsRepository;

  beforeEach(() => {
    db = createMockDatabase();
    repo = new AccountsRepository({ db, userId: USER_ID, now: () => FIXED_NOW });
  });

  it('generates a client UUID and stamps the timestamps', async () => {
    const id = await repo.insert({ name: 'HDFC Savings', type: 'bank' });

    expect(isUuid(id)).toBe(true);

    const call = db.lastCall()!;
    expect(call.sql).toContain('INSERT INTO accounts');
    // id, user_id, created_at, updated_at, deleted_at, then the values.
    expect(call.parameters).toEqual([
      id,
      USER_ID,
      FIXED_NOW.toISOString(),
      FIXED_NOW.toISOString(),
      null,
      'HDFC Savings',
      'bank',
    ]);
  });

  it('honours a caller-supplied id, so a retry cannot duplicate the row', async () => {
    const id = await repo.insert({ id: 'fixed-id', name: 'Cash', type: 'cash' });

    expect(id).toBe('fixed-id');
    expect(db.lastCall()!.parameters[0]).toBe('fixed-id');
  });

  it('stamps updated_at on every update - the sync tie-breaker', async () => {
    await repo.update('row-1', { name: 'Renamed' });

    const call = db.lastCall()!;
    expect(call.sql).toBe(
      'UPDATE accounts SET name = ?, updated_at = ? WHERE id = ? AND user_id = ?',
    );
    expect(call.parameters).toEqual(['Renamed', FIXED_NOW.toISOString(), 'row-1', USER_ID]);
  });

  it('deletes locally - the connector turns that into a soft delete', async () => {
    await repo.remove('row-1');

    expect(db.lastCall()).toEqual({
      sql: 'DELETE FROM accounts WHERE id = ? AND user_id = ?',
      parameters: ['row-1', USER_ID],
    });
  });

  it('reads exclude soft-deleted rows and scope to the owner', async () => {
    await repo.findById('row-1');

    const call = db.lastCall()!;
    expect(call.sql).toContain('deleted_at IS NULL');
    expect(call.sql).toContain('user_id = ?');
    expect(call.parameters).toEqual(['row-1', USER_ID]);
  });

  it('counts live rows', async () => {
    db.queueRow({ count: 3 });
    expect(await repo.count()).toBe(3);
  });

  it('returns zero when the count query finds nothing', async () => {
    expect(await repo.count()).toBe(0);
  });
});
