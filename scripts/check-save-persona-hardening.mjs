// Offline PostgreSQL 17 check; never reads app credentials or production URLs.
// --red exercises the owner-supplied production function without hardening SQL.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const ownerA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ownerB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const signature = "public.save_persona(uuid,text,text,text[],jsonb,text[])";
const label = "embalio-save-persona-check";
const observed = JSON.parse(readFileSync(new URL("../docs/security/2026-10-21-save-persona-definition.json", import.meta.url), "utf8"));
const original = observed.definition.replace(/;?\s*$/, ";");
let container;
const docker = (args, input) => spawnSync("docker", args, { input, encoding: "utf8", timeout: 60_000, maxBuffer: 1_000_000 });
function sql(query, expectedFailure = false) {
  const result = docker(["exec", "-i", container, "psql", "-X", "-q", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-t", "-A"], query);
  if (!expectedFailure && result.status !== 0) throw new Error(result.stderr || String(result.error));
  return result;
}

const fixture = `
drop schema if exists attacker cascade;
drop schema if exists public cascade;
drop schema if exists auth cascade;
create schema public;
create schema auth;
create schema attacker;
do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
end $$;
grant usage on schema public, auth, attacker to anon, authenticated, service_role;
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(pg_catalog.current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table public.profiles(
  id uuid primary key, user_id uuid not null, voice_spec text, goals text,
  content_pillars text[], onboarding_answers jsonb
);
create table public.seed_targets(
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id),
  handle text not null check(handle <> 'reject-me'),
  unique(profile_id,handle)
);
insert into public.profiles(id,user_id,voice_spec) values
  ('${ownerA}','${ownerA}','original_a'),('${ownerB}','${ownerB}','original_b');
alter table public.profiles enable row level security;
alter table public.seed_targets enable row level security;
create policy owner on public.profiles to authenticated
  using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy owner on public.seed_targets to authenticated
  using(exists(select 1 from public.profiles p where p.id=profile_id))
  with check(exists(select 1 from public.profiles p where p.id=profile_id));
grant select,insert,update,delete on public.profiles,public.seed_targets to authenticated,service_role;
create table attacker.profiles(like public.profiles including all);
create table attacker.seed_targets(like public.seed_targets including all);
insert into attacker.profiles(id,user_id,voice_spec) values('${ownerA}','${ownerA}','fake_original');
grant select,insert,update,delete on all tables in schema attacker to authenticated;
create function attacker.unnest(text[]) returns setof text language sql as $$ select 'hijacked'::text $$;
set search_path=public;
${original}
`;

const verify = `
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','${ownerA}',true);
set local search_path=attacker,public;
select public.save_persona('${ownerA}','own_update','goal',array['pillar'],'{"ok":true}',array['one','two','one','']);
reset role;
do $$ begin
  if (select voice_spec from public.profiles where id='${ownerA}') <> 'own_update' then
    raise exception 'caller search_path redirected writes away from public.profiles';
  end if;
  if (select voice_spec from attacker.profiles where id='${ownerA}') <> 'fake_original'
     or exists(select 1 from attacker.seed_targets) then
    raise exception 'function touched caller-controlled schema';
  end if;
  if (select count(*) from public.seed_targets where profile_id='${ownerA}') <> 2
     or exists(select 1 from public.seed_targets where handle='hijacked') then
    raise exception 'seed upsert/dedup or qualified unnest failed';
  end if;
  if not exists(select 1 from public.profiles where id='${ownerA}' and goals='goal'
      and content_pillars=array['pillar'] and onboarding_answers='{"ok":true}'::jsonb) then
    raise exception 'persona fields were not preserved';
  end if;
end $$;
set local role authenticated;
create temp table profiles(like public.profiles including all);
create temp table seed_targets(like public.seed_targets including all);
insert into pg_temp.profiles(id,user_id,voice_spec) values('${ownerA}','${ownerA}','fake_temp');
set local search_path=pg_temp,attacker,public;
select public.save_persona('${ownerA}','temp_proof','goal',array['pillar'],'{}',array['temp-seed']);
reset role;
do $$ begin
  if (select voice_spec from public.profiles where id='${ownerA}') <> 'temp_proof'
     or (select voice_spec from pg_temp.profiles where id='${ownerA}') <> 'fake_temp'
     or exists(select 1 from pg_temp.seed_targets) then
    raise exception 'temporary objects redirected writes';
  end if;
  execute 'set local role authenticated';
  begin
    perform public.save_persona('${ownerB}','foreign','goal',array['pillar'],'{}',array['foreign']);
    raise exception 'foreign profile write was accepted';
  exception when raise_exception then
    if sqlerrm not like '%not found%' then raise; end if;
  end;
  begin
    perform public.save_persona('${ownerA}','must_rollback','goal',array['pillar'],'{}',array['reject-me']);
    raise exception 'seed constraint failure was not raised';
  exception when check_violation then null; end;
  if (select voice_spec from public.profiles where id='${ownerA}') <> 'temp_proof' then
    raise exception 'profile update was not rolled back with failed seed insert';
  end if;
  perform set_config('request.jwt.claim.sub','',true);
  begin
    perform public.save_persona('${ownerA}','missing_user','goal',array['pillar'],'{}',array[]::text[]);
    raise exception 'missing auth user write was accepted';
  exception when raise_exception then
    if sqlerrm not like '%not found%' then raise; end if;
  end;
  execute 'reset role';
  execute 'set local role anon';
  begin
    perform public.save_persona('${ownerA}','anonymous','goal',array['pillar'],'{}',array[]::text[]);
    raise exception 'anonymous profile write was accepted';
  exception when insufficient_privilege then null; end;
  execute 'reset role';
  execute 'set local role service_role';
  perform public.save_persona('${ownerB}','service_update','goal',array['pillar'],'{}',array['service-seed']);
  execute 'reset role';
  if (select voice_spec from public.profiles where id='${ownerB}') <> 'service_update' then
    raise exception 'service-role compatibility failed';
  end if;
end $$;
rollback;
`;
const descriptor = `select json_build_object('oid',oid,'owner',proowner,'acl',proacl,'args',proargnames,
  'strict',proisstrict,'volatility',provolatile,'parallel',proparallel,'cost',procost,
  'returns',prorettype,'definer',prosecdef)::text from pg_proc where oid='${signature}'::regprocedure;`;

try {
  const created = docker(["run", "--detach", "--pull=never", "--network", "none", "--memory", "256m", "--cpus", "1", "--label", `dev.codex.owner=${label}`, "--tmpfs", "/var/lib/postgresql/data:rw", "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:17"]);
  if (created.status !== 0) throw new Error(created.stderr || String(created.error));
  container = created.stdout.trim();
  assert.match(container, /^[a-f0-9]{64}$/);
  for (let attempt = 0; ; attempt++) {
    if (docker(["exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"]).status === 0) break;
    if (attempt === 79) throw new Error("Disposable Postgres failed to start");
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  sql(fixture);
  const preflight = readFileSync(new URL("../docs/security/2026-10-21-save-persona-preflight.sql", import.meta.url), "utf8");
  sql(`begin read only;\n${preflight}\nrollback;`);
  if (process.argv.includes("--red")) {
    sql(verify);
    throw new Error("Observed production function unexpectedly resisted caller-controlled search_path");
  }
  const patch = readFileSync(new URL("../docs/security/2026-10-21-save-persona-hardening.sql", import.meta.url), "utf8");
  const before = sql(descriptor).stdout.trim();
  const expectedReceipt = { function: "public.save_persona", security_invoker: true, search_path_pinned: true, reviewed_body: true };
  assert.deepEqual(JSON.parse(sql(patch).stdout.trim()), expectedReceipt);
  assert.equal(sql(descriptor).stdout.trim(), before, "function owner/ACL/security contract changed");
  sql(verify);
  assert.deepEqual(JSON.parse(sql(patch).stdout.trim()), expectedReceipt);
  sql(verify);
  console.log("PASS: hostile schema/temp objects blocked; own fields/dedup/atomicity/RLS/service access preserved; rerun idempotent");
  for (const [name, mutation] of Object.entries({
    missing: `drop function ${signature};`,
    overload: "create function public.save_persona(uuid) returns void language plpgsql as $$ begin return; end $$;",
    definer: `alter function ${signature} security definer;`,
    body_drift: original.replace("begin", "begin\n  -- unknown production change"),
    settings: `alter function ${signature} set row_security=off;`,
    strict: `alter function ${signature} strict;`,
    cost: `alter function ${signature} cost 99;`,
    stable: `alter function ${signature} stable;`,
    rls_off: "alter table public.profiles disable row level security;",
  })) {
    sql(fixture);
    sql(mutation);
    const oldDefinition = sql(`select coalesce(string_agg(pg_get_functiondef(p.oid),E'\\n'),'missing') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='save_persona';`).stdout.trim();
    const refused = sql(patch, true);
    assert.notEqual(refused.status, 0, `${name}: unsafe input accepted`);
    assert.match(refused.stderr, /save_persona hardening:/, `${name}: unexpected failure`);
    const afterDefinition = sql(`select coalesce(string_agg(pg_get_functiondef(p.oid),E'\\n'),'missing') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='save_persona';`).stdout.trim();
    assert.equal(afterDefinition, oldDefinition, `${name}: refusal changed the function`);
    console.log(`PASS: ${name} refuses atomically`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (container) {
    const owner = docker(["inspect", "--format", '{{index .Config.Labels "dev.codex.owner"}}', container]);
    if (owner.status === 0 && owner.stdout.trim() === label) {
      const removed = docker(["rm", "--force", container]);
      if (removed.status !== 0) { console.error("Disposable container cleanup failed:", removed.stderr); process.exitCode = 1; }
      else console.log("CLEANUP: exact owned, network-isolated container removed");
    } else { console.error("Cleanup refused: ownership label mismatch"); process.exitCode = 1; }
  }
}
