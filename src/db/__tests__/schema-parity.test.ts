import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { AppSchema, SYNCED_TABLES } from '@/db/schema';

/**
 * Drift guard.
 *
 * Three things have to describe the same nine tables: the Postgres schema (via
 * the generated types), the local PowerSync schema, and the sync rules. A
 * column added to one and forgotten in another fails silently at runtime -
 * the row syncs but the field is always null - so it is checked here instead.
 */

const ROOT = join(__dirname, '..', '..', '..');

const generatedTypes = readFileSync(join(ROOT, 'src/db/database.types.ts'), 'utf8');
const syncRules = readFileSync(join(ROOT, 'powersync/sync-rules.yaml'), 'utf8');
const migration = readFileSync(
  join(ROOT, 'supabase/migrations/20260919090300_powersync_publication.sql'),
  'utf8',
);

/** Pulls the Row column names for a table out of the generated types file. */
function postgresColumns(table: string): string[] {
  const tableStart = generatedTypes.indexOf(`      ${table}: {`);
  if (tableStart === -1) {
    throw new Error(`${table} is missing from the generated database types`);
  }
  const rowStart = generatedTypes.indexOf('Row: {', tableStart);
  const rowEnd = generatedTypes.indexOf('};', rowStart);
  const body = generatedTypes.slice(rowStart, rowEnd);

  return [...body.matchAll(/^\s{10}(\w+)\??:/gm)].map((match) => match[1]!);
}

function localColumns(table: string): string[] {
  const resolved = AppSchema.tables.find((candidate) => candidate.name === table);
  if (!resolved) {
    throw new Error(`${table} is missing from the PowerSync schema`);
  }
  return resolved.columns.map((column) => column.name);
}

describe('the local schema mirrors Postgres', () => {
  it('declares every synced table', () => {
    expect(AppSchema.tables.map((table) => table.name).sort()).toEqual([...SYNCED_TABLES].sort());
  });

  it.each(SYNCED_TABLES)('%s has the same columns on both sides', (table) => {
    const postgres = postgresColumns(table).filter((column) => column !== 'id');
    const local = localColumns(table);

    expect([...local].sort()).toEqual([...postgres].sort());
  });

  it('never declares id - PowerSync supplies it', () => {
    for (const table of AppSchema.tables) {
      expect(table.columns.map((column) => column.name)).not.toContain('id');
    }
  });

  it('gives every table the ownership and soft-delete columns', () => {
    for (const table of AppSchema.tables) {
      const columns = table.columns.map((column) => column.name);
      expect(columns).toEqual(
        expect.arrayContaining(['user_id', 'created_at', 'updated_at', 'deleted_at']),
      );
    }
  });

  it('stores money as INTEGER paise, never REAL', () => {
    const moneyColumns = AppSchema.tables.flatMap((table) =>
      table.columns.filter((column) => column.name.endsWith('_paise')),
    );

    expect(moneyColumns.length).toBeGreaterThan(0);
    for (const column of moneyColumns) {
      expect(column.type).toBe('INTEGER');
    }
  });

  it('indexes every table by user_id', () => {
    for (const table of AppSchema.tables) {
      const indexed = table.indexes.flatMap((index) => index.columns.map((column) => column.name));
      expect(indexed).toContain('user_id');
    }
  });
});

describe('the sync rules match the schema', () => {
  it.each(SYNCED_TABLES)('selects from %s', (table) => {
    expect(syncRules).toContain(`FROM ${table} `);
  });

  it('filters every table by the bucket owner and excludes deleted rows', () => {
    const selects = syncRules
      .split('\n')
      .filter((line) => line.includes('SELECT * FROM'))
      .map((line) => line.trim());

    expect(selects).toHaveLength(SYNCED_TABLES.length);
    for (const select of selects) {
      expect(select).toContain('user_id = bucket.user_id');
      expect(select).toContain('deleted_at IS NULL');
    }
  });

  it('parameterises the bucket on the authenticated user', () => {
    expect(syncRules).toContain('request.user_id()');
  });
});

describe('the publication matches the schema', () => {
  it.each(SYNCED_TABLES)('replicates %s', (table) => {
    expect(migration).toContain(`public.${table}`);
  });
});
