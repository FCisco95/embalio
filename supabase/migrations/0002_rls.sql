alter table profiles      enable row level security;
alter table seed_targets  enable row level security;
alter table candidates    enable row level security;
alter table drafts        enable row level security;
alter table posts         enable row level security;

create policy "own profiles" on profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own seed_targets" on seed_targets for all
  using (exists (select 1 from profiles p where p.id = seed_targets.profile_id and p.user_id = auth.uid()))
  with check (exists (select 1 from profiles p where p.id = seed_targets.profile_id and p.user_id = auth.uid()));

create policy "own candidates" on candidates for all
  using (exists (select 1 from profiles p where p.id = candidates.profile_id and p.user_id = auth.uid()))
  with check (exists (select 1 from profiles p where p.id = candidates.profile_id and p.user_id = auth.uid()));

create policy "own drafts" on drafts for all
  using (exists (select 1 from profiles p where p.id = drafts.profile_id and p.user_id = auth.uid()))
  with check (exists (select 1 from profiles p where p.id = drafts.profile_id and p.user_id = auth.uid()));

create policy "own posts" on posts for all
  using (exists (select 1 from profiles p where p.id = posts.profile_id and p.user_id = auth.uid()))
  with check (exists (select 1 from profiles p where p.id = posts.profile_id and p.user_id = auth.uid()));
