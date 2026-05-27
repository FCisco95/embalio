-- Normalize existing seed_target handles (lowercase, strip leading @) so the
-- unique index lands on a clean canonical form, and remove any duplicates that
-- already exist before adding the constraint.

-- 1. Normalize: strip leading @ and lowercase.
update seed_targets
  set handle = lower(trim('@' from handle))
  where handle is not null;

-- 2. Remove duplicates — keep exactly one row per (profile_id, handle).
--    Uses row_number() with id as tiebreaker so equal-timestamp duplicates
--    (which the added_at > comparison would leave behind) are always resolved.
delete from seed_targets
  where id in (
    select id from (
      select id,
             row_number() over (
               partition by profile_id, handle
               order by added_at, id
             ) as rn
        from seed_targets
       where handle is not null
    ) ranked
    where rn > 1
  );

-- 3. Unique constraint on (profile_id, handle) — handles are now pre-normalized.
alter table seed_targets
  add constraint seed_targets_profile_handle_unique
  unique (profile_id, handle);

-- 4. Atomic save_persona RPC: updates profile fields and upserts seed_targets in
--    a single transaction.  Runs as security invoker so RLS on both tables applies
--    (the caller must own the profile).
create or replace function save_persona(
  p_profile_id       uuid,
  p_voice_spec       text,
  p_goals            text,
  p_content_pillars  text[],
  p_onboarding_answers jsonb,
  p_seed_handles     text[]
) returns void language plpgsql as $$
begin
  update profiles
    set voice_spec          = p_voice_spec,
        goals               = p_goals,
        content_pillars     = p_content_pillars,
        onboarding_answers  = p_onboarding_answers
    where id = p_profile_id;

  if not found then
    raise exception 'profile % not found or access denied', p_profile_id;
  end if;

  -- Upsert seed_targets; handles arrive pre-normalized (lowercase, no @) from
  -- the application layer, so conflicts on the unique index are safe to ignore.
  insert into seed_targets (profile_id, handle)
    select p_profile_id, h
      from unnest(p_seed_handles) as h
      where h <> ''
  on conflict (profile_id, handle) do nothing;
end;
$$;
