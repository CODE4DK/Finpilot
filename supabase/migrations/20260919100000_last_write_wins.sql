-- Conflict resolution: last write wins, decided by updated_at.
--
-- The original set_updated_at() stamped now() on every UPDATE, which threw
-- away the client's timestamp. That makes the winner "whichever write reached
-- the server last", not "whichever edit happened last" - and those differ
-- exactly when it matters: a device that was offline for an hour uploads
-- stale edits that would clobber newer ones made elsewhere.
--
-- The replacement keeps the server authoritative about the clock while
-- honouring the client's ordering:
--
--   * A client that sends updated_at is making a claim about when the edit
--     happened. If that claim is older than what the row already has, the
--     write is stale and is skipped entirely (the trigger returns the old
--     row, so nothing changes).
--   * Otherwise updated_at is set to the client's value, clamped so a device
--     with a fast clock cannot stamp a row into the future and win every
--     subsequent conflict.
--   * A client that sends no updated_at (psql, the dashboard, an Edge
--     Function) gets now() as before.
--
-- See docs/SYNC.md for how this pairs with the upload queue.

/** How far ahead of the server a client clock is allowed to be. */
create or replace function public.max_clock_skew()
returns interval
language sql
immutable
as $$
  select interval '5 minutes';
$$;

comment on function public.max_clock_skew is
  'Upper bound on how far a client-supplied updated_at may lead the server clock.';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
declare
  client_timestamp timestamptz := new.updated_at;
  ceiling timestamptz := now() + public.max_clock_skew();
begin
  -- No claim from the client, or the same value the row already had (a plain
  -- server-side update): just stamp the server clock.
  if client_timestamp is null or client_timestamp = old.updated_at then
    new.updated_at := now();
    return new;
  end if;

  -- A stale write. Skip it: the row keeps the newer state.
  if client_timestamp < old.updated_at then
    return old;
  end if;

  -- Honour the client's timestamp, but never let it run away from the server.
  new.updated_at := least(client_timestamp, ceiling);
  return new;
end;
$$;

comment on function public.set_updated_at is
  'BEFORE UPDATE trigger: last write wins by updated_at, with the server clock as the ceiling. Stale writes are skipped.';
