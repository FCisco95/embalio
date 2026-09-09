-- Harden the remaining historically RLS-off profile-linked tables after moving
-- their app reads/writes onto service-role code paths.
--
-- These tables stay server-only for now: no anon/authenticated grants are added
-- back in this migration. A future auth/client-strategy change can re-expose
-- selected tables with explicit grants + owner-scoped policies.

alter table public.activity_events enable row level security;
alter table public.analytics_daily enable row level security;
alter table public.follower_snapshots enable row level security;
alter table public.topic_history enable row level security;
alter table public.predictions enable row level security;
alter table public.strategy_snapshots enable row level security;

revoke all privileges on table public.activity_events from anon, authenticated;
revoke all privileges on table public.analytics_daily from anon, authenticated;
revoke all privileges on table public.follower_snapshots from anon, authenticated;
revoke all privileges on table public.topic_history from anon, authenticated;
revoke all privileges on table public.predictions from anon, authenticated;
revoke all privileges on table public.strategy_snapshots from anon, authenticated;
