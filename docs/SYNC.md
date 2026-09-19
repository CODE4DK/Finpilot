# Sync design

FinPilot is offline-first. Every screen reads from a local SQLite database and
every write lands there first; PowerSync replicates in both directions when
there is a network. Losing connectivity is the normal case, not the error case.

## The shape of it

```
   ┌─────────────────────────────────────────────┐
   │  Screens  ──useQuery──▶  local SQLite       │
   │     │                     (op-sqlite)       │
   │     └──repositories──▶         │            │
   └────────────────────────────────┼────────────┘
                                    │
                      PowerSync client SDK
                                    │
                 ┌──────────────────┴──────────────────┐
                 │                                     │
          download: buckets                    upload: CRUD queue
                 │                                     │
   PowerSync Service ◀── logical replication ──┐   PostgREST
                 │                             │       │
                 └────────▶ Supabase Postgres ─┴───────┘
```

- **Reads** never touch the network. `useQuery` re-runs whenever the rows it
  depends on change, from a local write or an incoming sync.
- **Writes** go to local SQLite and enter an ordered upload queue. The UI is
  updated before anything leaves the device.
- **Downloads** arrive as buckets: the sync rules decide what belongs in each
  user's bucket, and the client keeps its copy in step.

## Files

| File                        | Role                                                        |
| --------------------------- | ----------------------------------------------------------- |
| `src/db/schema.ts`          | Local SQLite schema, mirroring the nine Postgres tables     |
| `powersync/sync-rules.yaml` | Which rows belong to which user (deployed in the dashboard) |
| `src/db/connector.ts`       | `fetchCredentials` and `uploadData`                         |
| `src/db/upload-errors.ts`   | Transient vs permanent failure triage                       |
| `src/db/powersync.ts`       | The database instance and its lifecycle                     |
| `src/db/repositories/*`     | Queries and local-first writes                              |
| `src/db/hooks.ts`           | Reactive hooks over those queries                           |
| `src/db/sync-status.ts`     | PowerSync status → the four states a user sees              |
| `src/features/sync/*`       | The header indicator and its detail sheet                   |

## Type translation

SQLite has three storage classes, so three things change on the way down:

| Postgres       | SQLite    | Read with                     |
| -------------- | --------- | ----------------------------- |
| `bigint` paise | `INTEGER` | `toPaise`                     |
| `boolean`      | `INTEGER` | `toBoolean` (0/1)             |
| `timestamptz`  | `TEXT`    | `toDate` / `toOptionalDate`   |
| `date`         | `TEXT`    | plain `YYYY-MM-DD` comparison |
| `jsonb`        | `TEXT`    | `toJson`                      |

`src/db/row-mappers.ts` is the only place that knows this. `id` is never
declared in the local schema — PowerSync supplies a TEXT primary key itself.

A test (`src/db/__tests__/schema-parity.test.ts`) asserts that the generated
Postgres types, the local schema and the sync rules describe the same tables
and columns. A column added to one and forgotten in another otherwise fails
silently: the row syncs, the field is always null.

## Sync rules

One bucket per user:

```yaml
bucket_definitions:
  user_data:
    parameters: SELECT request.user_id() AS user_id
    data:
      - SELECT * FROM transactions WHERE user_id = bucket.user_id AND deleted_at IS NULL
      # …one line per table
```

`request.user_id()` is the `sub` claim of the Supabase JWT — the same value
every `user_id` column holds. Rows are filtered twice over: by this parameter,
and by Postgres RLS on the replication connection. Neither is load-bearing on
its own.

**Soft-deleted rows are excluded on purpose.** Setting `deleted_at` moves a row
out of the bucket, and PowerSync then removes it from every device. A delete
replicates without a hard delete ever happening server-side, which is what the
schema requires (there is no DELETE policy for clients).

Editing the YAML in this repo changes nothing by itself — deploy it in the
PowerSync dashboard.

## The upload queue

`uploadData` drains one CRUD transaction at a time:

| Local operation | Sent as                                           |
| --------------- | ------------------------------------------------- |
| `INSERT`        | `upsert`, with the client-generated id            |
| `UPDATE`        | `update … eq('id', …)`                            |
| `DELETE`        | `update … set deleted_at = now()` — a soft delete |

The queue is **strictly ordered**: PowerSync retries the head until it
succeeds. That is right for a flaky network and wrong for a row the server will
never accept — a constraint violation retried forever blocks every later write
on that device. So failures are triaged:

- **Transient** (network error, timeout, HTTP 429/5xx, a Postgres class other
  than 22/23/42) → rethrown, PowerSync retries with backoff.
- **Permanent** (SQLSTATE `22xxx` data exception, `23xxx` constraint violation,
  `42501` RLS refusal, HTTP 4xx) → logged through `onDiscardedUpload` and the
  transaction completed anyway. The write is lost; the queue keeps moving.

Anything unrecognised is treated as **transient**, because discarding a write
we do not understand loses the user's data. Discarding is the exceptional path
and it is always logged with the table, operation and row id — never the row's
values, which are someone's finances.

## Conflict strategy: last write wins, by `updated_at`

Two devices can edit the same row while one is offline. The winner is the edit
with the **later `updated_at`**, not the one that happens to upload last.

Making that true took a server-side change (migration
`20260919100000_last_write_wins.sql`). The original trigger stamped `now()` on
every update, which discarded the client's timestamp — so a device that had
been offline for an hour would clobber newer edits simply by reconnecting.
The trigger now:

1. **No client `updated_at`** (psql, the dashboard, an Edge Function) → stamp
   `now()`, as before.
2. **Client `updated_at` older than the stored row** → the write is stale;
   return the old row unchanged. The _entire_ write is discarded, including
   columns the newer edit never touched.
3. **Otherwise** → keep the client's timestamp, clamped to
   `now() + max_clock_skew()` (5 minutes) so a device with a fast clock cannot
   stamp a row into the future and win every conflict thereafter.

Repositories always set `updated_at` from the client clock on write, which is
what feeds this.

**What this does and does not give you.** Resolution is per row, not per
column: two people editing different fields of the same transaction still means
one edit is lost. Nothing is merged. For FinPilot — one person, a phone and
maybe a tablet — that is the right trade; a ledger with concurrent editors
would need per-field timestamps or CRDTs.

A stale **delete** loses to a newer edit, and a stale **edit** loses to a newer
delete. Both fall out of the same rule, and both are covered in
`supabase/tests/03_conflict_resolution.test.sql`.

## Sync status

`src/db/sync-status.ts` reduces PowerSync's status to four states:

| State     | Means                                               | Shown as      |
| --------- | --------------------------------------------------- | ------------- |
| `synced`  | Connected, caught up, nothing in flight             | cloud-done    |
| `syncing` | Connecting, transferring, or the first sync pending | sync arrows   |
| `offline` | Not connected and not trying                        | cloud-offline |
| `error`   | A download or upload error is outstanding           | alert         |

An error is surfaced **even while connected**, because uploads can fail while
downloads still work. The indicator pairs colour with an icon — colour alone
never carries the meaning.

## Lifecycle

- **Connect** when the auth store reports `signedIn` (`useSyncLifecycle`).
- **Disconnect** when the session goes away — but _do not_ clear. A transient
  token failure must not throw away offline work.
- **Disconnect and clear** on an explicit sign-out (`signOutEverywhere`), before
  the Supabase call. On a shared device the local rows are someone's finances;
  they do not outlive the session.

## Working on it

```bash
npm run db:test    # includes the conflict-resolution suite
npm test           # repositories, connector, status mapping, schema parity
```

Repositories are tested against `createMockDatabase`, which records the SQL and
parameters they produce. op-sqlite is a native module and cannot open a
database under Jest, so the alternative would be no coverage at all — the
trade is that these tests prove the _queries_, not SQLite's execution of them.

On device, PowerSync's own diagnostics help:

```ts
const db = getPowerSync();
console.log(await db.getUploadQueueStats()); // queued write count
console.log(db.currentStatus); // connection and flow state
```

## Setting it up

1. Create a PowerSync instance and point it at the Supabase database using the
   `powersync_role` and the `powersync` publication (see
   [docs/DATABASE.md](./DATABASE.md)).
2. Paste `powersync/sync-rules.yaml` into the instance's **Sync Rules** and
   deploy.
3. Set `EXPO_PUBLIC_POWERSYNC_URL` in `.env` to the instance URL.
4. Add the Supabase JWKS to the instance's client auth so it can verify the
   tokens `fetchCredentials` supplies.
5. Rebuild the development build — op-sqlite is a native module.
