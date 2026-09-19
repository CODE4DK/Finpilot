#!/usr/bin/env node
/**
 * Generates src/db/database.types.ts from a live Postgres schema.
 *
 * `supabase gen types typescript` is the canonical generator, but it runs
 * pg-meta in a container and therefore needs Docker. This script reads the
 * same catalog directly and emits the same shape supabase-js consumes
 * (Database['public']['Tables'][T]['Row' | 'Insert' | 'Update']), so the types
 * can be regenerated in any environment.
 *
 * Usage: node scripts/generate-database-types.mjs [connection-string]
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import pg from 'pg';

const CONNECTION =
  process.argv[2] ??
  process.env.DATABASE_URL ??
  'postgresql://postgres@localhost:5432/finpilot_types';
const OUTPUT = new URL('../src/db/database.types.ts', import.meta.url);

/** Postgres type -> TypeScript type. */
const TYPE_MAP = {
  uuid: 'string',
  text: 'string',
  citext: 'string',
  varchar: 'string',
  bpchar: 'string',
  bool: 'boolean',
  int2: 'number',
  int4: 'number',
  // PostgREST serialises int8 as a JSON number; every paise column fits
  // comfortably inside Number.MAX_SAFE_INTEGER.
  int8: 'number',
  float4: 'number',
  float8: 'number',
  numeric: 'number',
  date: 'string',
  timestamp: 'string',
  timestamptz: 'string',
  time: 'string',
  timetz: 'string',
  json: 'Json',
  jsonb: 'Json',
};

function tsType(udtName, isNullable) {
  const base = TYPE_MAP[udtName] ?? 'unknown';
  return isNullable ? `${base} | null` : base;
}

const client = new pg.Client({ connectionString: CONNECTION });
await client.connect();

const { rows: columns } = await client.query(`
  select
    c.relname as table_name,
    a.attname as column_name,
    a.attnum as ordinal,
    format_type(a.atttypid, null) as formatted_type,
    t.typname as udt_name,
    not a.attnotnull as is_nullable,
    pg_get_expr(d.adbin, d.adrelid) is not null as has_default,
    a.attidentity <> '' as is_identity,
    col_description(c.oid, a.attnum) as comment
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_type t on t.oid = a.atttypid
  left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
  where n.nspname = 'public'
    and c.relkind = 'r'
    and a.attnum > 0
    and not a.attisdropped
  order by c.relname, a.attnum
`);

const { rows: foreignKeys } = await client.query(`
  select
    con.conname as constraint_name,
    child.relname as table_name,
    (select array_agg(att.attname::text order by k.ord)
       from unnest(con.conkey) with ordinality as k(attnum, ord)
       join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k.attnum
    ) as columns,
    parent.relname as referenced_table,
    (select array_agg(att.attname::text order by k.ord)
       from unnest(con.confkey) with ordinality as k(attnum, ord)
       join pg_attribute att on att.attrelid = con.confrelid and att.attnum = k.attnum
    ) as referenced_columns,
    -- One-to-one when the referencing columns are themselves unique.
    exists (
      select 1 from pg_index i
      where i.indrelid = con.conrelid
        and i.indisunique
        and i.indnatts = array_length(con.conkey, 1)
        and (
          select array_agg(x order by x) from unnest(i.indkey::int[]) as x
        ) = (
          select array_agg(x order by x) from unnest(con.conkey::int[]) as x
        )
    ) as is_one_to_one
  from pg_constraint con
  join pg_class child on child.oid = con.conrelid
  join pg_namespace child_ns on child_ns.oid = child.relnamespace
  join pg_class parent on parent.oid = con.confrelid
  where con.contype = 'f' and child_ns.nspname = 'public'
  order by child.relname, con.conname
`);

const { rows: tableComments } = await client.query(`
  select c.relname as table_name, obj_description(c.oid) as comment
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
`);

await client.end();

const tables = [...new Set(columns.map((column) => column.table_name))].sort();
const commentFor = new Map(tableComments.map((row) => [row.table_name, row.comment]));

const lines = [];
lines.push('// Generated file - do not edit by hand.');
lines.push('//');
lines.push('// Regenerate with:  npm run db:types');
lines.push('// (which runs scripts/generate-database-types.mjs against a database that has');
lines.push('//  supabase/migrations applied; `supabase gen types typescript` produces the');
lines.push('//  same shape when Docker is available).');
lines.push('');
lines.push(
  'export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];',
);
lines.push('');
lines.push('export interface Database {');
lines.push('  public: {');
lines.push('    Tables: {');

for (const table of tables) {
  const tableColumns = columns.filter((column) => column.table_name === table);
  const comment = commentFor.get(table);
  if (comment) {
    lines.push(`      /** ${comment} */`);
  }
  lines.push(`      ${table}: {`);

  lines.push('        Row: {');
  for (const column of tableColumns) {
    lines.push(`          ${column.column_name}: ${tsType(column.udt_name, column.is_nullable)};`);
  }
  lines.push('        };');

  lines.push('        Insert: {');
  for (const column of tableColumns) {
    // A column is optional on insert when the database can fill it in.
    const optional = column.has_default || column.is_nullable || column.is_identity;
    lines.push(
      `          ${column.column_name}${optional ? '?' : ''}: ${tsType(column.udt_name, column.is_nullable)};`,
    );
  }
  lines.push('        };');

  lines.push('        Update: {');
  for (const column of tableColumns) {
    lines.push(`          ${column.column_name}?: ${tsType(column.udt_name, column.is_nullable)};`);
  }
  lines.push('        };');

  lines.push('        Relationships: [');
  for (const fk of foreignKeys.filter((row) => row.table_name === table)) {
    lines.push('          {');
    lines.push(`            foreignKeyName: '${fk.constraint_name}';`);
    lines.push(`            columns: [${fk.columns.map((c) => `'${c}'`).join(', ')}];`);
    lines.push(`            isOneToOne: ${Boolean(fk.is_one_to_one)};`);
    lines.push(`            referencedRelation: '${fk.referenced_table}';`);
    lines.push(
      `            referencedColumns: [${fk.referenced_columns.map((c) => `'${c}'`).join(', ')}];`,
    );
    lines.push('          },');
  }
  lines.push('        ];');
  lines.push('      };');
}

lines.push('    };');
lines.push('    Views: Record<never, never>;');
lines.push('    Functions: Record<never, never>;');
lines.push('    Enums: Record<never, never>;');
lines.push('    CompositeTypes: Record<never, never>;');
lines.push('  };');
lines.push('}');
lines.push('');

lines.push('type PublicSchema = Database["public"];');
lines.push('');
lines.push('export type Tables<T extends keyof PublicSchema["Tables"]> =');
lines.push('  PublicSchema["Tables"][T]["Row"];');
lines.push('export type TablesInsert<T extends keyof PublicSchema["Tables"]> =');
lines.push('  PublicSchema["Tables"][T]["Insert"];');
lines.push('export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =');
lines.push('  PublicSchema["Tables"][T]["Update"];');
lines.push('');

writeFileSync(OUTPUT, lines.join('\n'));

// Format the output so a regeneration never shows up as a formatting diff.
execFileSync('npx', ['prettier', '--write', OUTPUT.pathname], { stdio: 'ignore' });

console.log(`Wrote ${OUTPUT.pathname} (${tables.length} tables)`);
