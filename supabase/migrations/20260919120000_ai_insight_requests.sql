-- AI insight request log.
--
-- Every call to the generate-insights Edge Function writes one row here,
-- whether it succeeded or not. Two reasons:
--
--   * it is the rate limit. "N per user per day" has to count attempts, not
--     results, or a user who triggers ten failing calls has still cost ten
--     calls to the model;
--   * it is the audit trail for a feature that sends data to a third party.
--     A user who opts out later can still see how often it ran.
--
-- The table is **server-side only**. It is not in the PowerSync publication,
-- clients have no privileges on it, and RLS is enabled with no policies at
-- all, so even a leaked anon key reads nothing. Only the service role - which
-- bypasses RLS and is never in the app bundle - touches it.

create table public.ai_insight_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The month the insight was asked for, not the month it was asked in.
  month date not null,
  requested_at timestamptz not null default now(),
  status text not null,
  -- Which model answered, so a regression can be traced to a model change.
  model text,
  -- Token counts for cost tracking. Never any of the user's content.
  input_tokens integer,
  output_tokens integer,
  -- A short reason when status is not 'succeeded'. Never the model's output.
  detail text,
  constraint ai_insight_requests_status_valid
    check (status in ('succeeded', 'model_error', 'invalid_response', 'rate_limited', 'not_opted_in')),
  constraint ai_insight_requests_month_is_first_of_month
    check (month = date_trunc('month', month)::date),
  constraint ai_insight_requests_detail_length
    check (detail is null or char_length(detail) <= 500)
);

comment on table public.ai_insight_requests is
  'One row per generate-insights call. Server-side only: the rate limit and the audit trail for the AI feature.';

-- The rate-limit query: this user, today.
create index ai_insight_requests_user_day_idx
  on public.ai_insight_requests (user_id, requested_at desc);

alter table public.ai_insight_requests enable row level security;
alter table public.ai_insight_requests force row level security;

-- Deliberately no policies: there is nothing here a client may do.
revoke all on public.ai_insight_requests from anon, authenticated;
