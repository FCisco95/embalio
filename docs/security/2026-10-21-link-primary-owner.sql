-- OWNER-RUN. Changes only the currently unlinked @fcisco95 profile's user_id.
-- Paste the independently verified Authentication -> Users UUID below in the
-- SQL Editor copy. Keep this repository template free of actual account IDs.
-- Existing different owners, duplicate handles, missing/unconfirmed auth users
-- stop the transaction. No auth user or unrelated profile is edited/deleted.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '15s';
set local row_security = off;
do $link$
declare
  expected_primary_owner uuid := null;
begin
  if expected_primary_owner is null then
    raise exception 'Primary owner link: set the independently verified auth UUID';
  end if;
  if not exists(select 1 from auth.users where id=expected_primary_owner and email_confirmed_at is not null) then
    raise exception 'Primary owner link: expected auth user is missing or email is unconfirmed';
  end if;
  lock table public.profiles in share row exclusive mode;
  if (select count(*) from public.profiles where lower(ltrim(btrim(handle),'@'))='fcisco95') <> 1 then
    raise exception 'Primary owner link: expected exactly one fcisco95 profile';
  end if;
  if exists(select 1 from public.profiles where lower(ltrim(btrim(handle),'@'))='fcisco95'
    and user_id is not null and user_id <> expected_primary_owner) then
    raise exception 'Primary owner link: profile already belongs to another user; manual review required';
  end if;
  update public.profiles set user_id=expected_primary_owner
    where lower(ltrim(btrim(handle),'@'))='fcisco95' and user_id is null;
  if not exists(select 1 from public.profiles where lower(ltrim(btrim(handle),'@'))='fcisco95'
    and user_id=expected_primary_owner) then
    raise exception 'Primary owner link: postcondition failed';
  end if;
end
$link$;
commit;
