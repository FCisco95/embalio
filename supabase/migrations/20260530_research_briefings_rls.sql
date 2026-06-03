-- Harden research_briefings ahead of a possible multi-user deploy.
--
-- Created with RLS DISABLED and profile_id as bare text (no FK). That is a
-- cross-tenant leak the moment more than one user exists: any authenticated
-- client could read every tenant's briefings. The cron writer uses the
-- service-role key, which bypasses RLS, so enabling RLS does not break it.

-- 1. profile_id text -> uuid + FK to profiles, so the RLS policy can join on it
--    and orphaned rows can't exist. (Assumes existing values are valid profile
--    uuids; on a fresh/local DB there are none to migrate.)
alter table public.research_briefings
  alter column profile_id type uuid using profile_id::uuid;

alter table public.research_briefings
  add constraint research_briefings_profile_id_fkey
  foreign key (profile_id) references public.profiles(id) on delete cascade;

-- 2. Enable RLS and scope reads/writes to the owning user, matching the policy
--    shape used for drafts/candidates/etc. in 0002_rls.sql. service_role still
--    bypasses this for the cron writer.
alter table public.research_briefings enable row level security;

create policy "own research_briefings" on public.research_briefings for all
  using (exists (select 1 from public.profiles p where p.id = research_briefings.profile_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.profiles p where p.id = research_briefings.profile_id and p.user_id = auth.uid()));
