// Explicit, disposable PostgreSQL integration check. Never reads app credentials.
// Usage: node scripts/check-rls-recovery.mjs [--red | --containment | --red-containment]
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const ownerTables = ["profiles", "seed_targets", "candidates", "drafts", "posts", "posting_accounts", "posting_jobs", "research_briefings", "watch_targets", "sniper_alerts", "push_subscriptions"];
const privateTables = ["signal_tweets", "tweet_metric_snapshots", "activity_events", "topic_history", "follower_snapshots", "analytics_daily", "predictions", "strategy_snapshots"];
const tables = [...ownerTables, ...privateTables];
const sqlList = values => values.map(value => `'${value}'`).join(",");
const a = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const b = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const label = "embalio-rls-recovery";
let container;

function docker(args, input) {
  return spawnSync("docker", args, { input, encoding: "utf8", timeout: 60_000, maxBuffer: 2_000_000 });
}
function sql(query, expectFailure = false) {
  const result = docker(["exec", "-i", container, "psql", "-X", "-q", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-t", "-A"], query);
  if (!expectFailure && result.status !== 0) throw new Error(result.stderr || String(result.error));
  return result;
}

const fixture = `
drop schema if exists public cascade;
drop schema if exists auth cascade;
create schema public;
create schema auth;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
  if not exists (select 1 from pg_roles where rolname='legacy_reader') then create role legacy_reader; end if;
end $$;
revoke legacy_reader from anon, authenticated;
revoke postgres from anon;
revoke authenticated from anon;
revoke pg_maintain from authenticated;
alter role anon nosuperuser nobypassrls;
alter role authenticated nosuperuser nobypassrls;
alter role service_role bypassrls;
grant usage on schema public, auth to anon, authenticated, service_role;
create table auth.users(id uuid primary key, email_confirmed_at timestamptz default now());
insert into auth.users(id) values ('${a}'),('${b}');
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table public.profiles(id uuid primary key default gen_random_uuid(), user_id uuid, handle text);
insert into public.profiles values ('${a}','${a}','fcisco95'),('${b}','${b}','owner_b');
${tables.filter(t => t !== "profiles").map(t => ["signal_tweets", "tweet_metric_snapshots"].includes(t) ? `
create table public.${t}(id uuid primary key default gen_random_uuid(), payload text);
insert into public.${t}(payload) values ('global_a'),('global_b');` : `
create table public.${t}(id uuid primary key default gen_random_uuid(), profile_id ${t === "research_briefings" ? "text" : "uuid"}, payload text);
insert into public.${t}(profile_id,payload) values ('${a}','owner_a'),('${b}','owner_b');`).join("\n")}
grant all on all tables in schema public to anon, authenticated, service_role;
grant select on all tables in schema public to public;
-- Verify that table-level revocation also clears pre-existing column grants.
grant select(id) on public.profiles to anon;
grant select(payload) on public.signal_tweets to public;
${ownerTables.map(t => `create policy legacy_allow_all on public.${t} using (true) with check (true);`).join("\n")}
`;

const verify = `
begin;
do $$
declare t text; n bigint; blocked boolean; inserted_id uuid; inserted_owner uuid; changed bigint;
begin
  -- This must fail on the screenshot's RLS-off/default-grant state.
  execute 'set local role anon';
  foreach t in array array[${sqlList(tables)}] loop
    blocked := false;
    begin execute format('select count(id) from public.%I',t) into n;
    exception when insufficient_privilege then blocked := true; end;
    if not blocked then raise exception 'anon can read public.% (% rows)', t, n; end if;
    if has_table_privilege('anon',format('public.%I',t),'INSERT,UPDATE,DELETE,TRUNCATE') then
      raise exception 'anon retains write privileges on %',t;
    end if;
    if has_any_column_privilege('anon',format('public.%I',t),'SELECT,INSERT,UPDATE,REFERENCES') then
      raise exception 'anon retains column privileges on %',t;
    end if;
  end loop;
  execute 'reset role';
  foreach t in array array[${sqlList(tables)}] loop
    if not (select relrowsecurity from pg_class where oid=format('public.%I',t)::regclass) then
      raise exception 'RLS remains disabled on %',t;
    end if;
    if has_table_privilege('authenticated',format('public.%I',t),'TRUNCATE') then
      raise exception 'authenticated can truncate %',t;
    end if;
  end loop;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub','${a}',true);
  foreach t in array array[${sqlList(ownerTables)}] loop
    execute format('select count(*) from public.%I',t) into n;
    if n <> 1 then raise exception 'owner A isolation failed on %: saw % rows',t,n; end if;
    blocked := false;
    begin
      if t='profiles' then execute 'insert into public.profiles(user_id,handle) values (''${b}'',''foreign'')';
      else execute format('insert into public.%I(profile_id,payload) values (''${b}'',''foreign'')',t); end if;
    exception when insufficient_privilege then blocked := true; end;
    if not blocked then raise exception 'foreign INSERT succeeded on %',t; end if;
    blocked := false;
    begin
      if t='profiles' then execute 'update public.profiles set user_id=''${b}'' where id=''${a}''';
      else execute format('update public.%I set profile_id=''${b}'' where profile_id::text=''${a}''',t); end if;
    exception when insufficient_privilege then blocked := true; end;
    if not blocked then raise exception 'owner reassignment succeeded on %',t; end if;
    if t='profiles' then
      insert into public.profiles(handle) values ('created_like_app') returning id,user_id into inserted_id,inserted_owner;
      if inserted_owner is distinct from '${a}'::uuid then raise exception 'profile default did not use auth.uid()'; end if;
      update public.profiles set handle='edited' where id=inserted_id;
      get diagnostics changed = row_count;
      if changed <> 1 or not exists(select 1 from public.profiles where id=inserted_id and handle='edited') then
        raise exception 'own UPDATE failed on profiles';
      end if;
      delete from public.profiles where id=inserted_id;
      delete from public.profiles where id='${b}';
      get diagnostics changed = row_count;
      if changed <> 0 then raise exception 'foreign DELETE succeeded on profiles'; end if;
      update public.profiles set handle='foreign_edit' where id='${b}';
    else
      execute format('insert into public.%I(profile_id,payload) values (''${a}'',''own_insert'') returning id',t) into inserted_id;
      execute format('update public.%I set payload=''own_update'' where id=$1',t) using inserted_id;
      get diagnostics changed = row_count;
      if changed <> 1 then raise exception 'own UPDATE failed on %',t; end if;
      execute format('delete from public.%I where id=$1',t) using inserted_id;
      execute format('delete from public.%I where profile_id::text=''${b}''',t);
      get diagnostics changed = row_count;
      if changed <> 0 then raise exception 'foreign DELETE succeeded on %',t; end if;
      execute format('update public.%I set payload=''foreign_edit'' where profile_id::text=''${b}''',t);
    end if;
    get diagnostics changed = row_count;
    if changed <> 0 then raise exception 'foreign UPDATE was visible on %',t; end if;
  end loop;
  foreach t in array array[${sqlList(privateTables)}] loop
    blocked := false;
    begin execute format('select count(*) from public.%I',t) into n;
    exception when insufficient_privilege then blocked := true; end;
    if not blocked then raise exception 'authenticated can read internal table %',t; end if;
  end loop;
  perform set_config('request.jwt.claim.sub','${b}',true);
  foreach t in array array[${sqlList(ownerTables)}] loop
    execute format('select count(*) from public.%I',t) into n;
    if n <> 1 then raise exception 'owner B isolation failed on %',t; end if;
  end loop;
  perform set_config('request.jwt.claim.sub','',true);
  foreach t in array array[${sqlList(ownerTables)}] loop
    execute format('select count(*) from public.%I',t) into n;
    if n <> 0 then raise exception 'missing auth.uid() sees rows on %',t; end if;
  end loop;
  execute 'reset role';
  execute 'set local role service_role';
  foreach t in array array[${sqlList(tables)}] loop
    execute format('select count(*) from public.%I',t) into n;
    if n <> 2 then raise exception 'service role lost access to %',t; end if;
    if not (has_table_privilege('service_role',format('public.%I',t),'INSERT')
      and has_table_privilege('service_role',format('public.%I',t),'UPDATE')
      and has_table_privilege('service_role',format('public.%I',t),'DELETE')) then
      raise exception 'service role lost CRUD on %',t;
    end if;
  end loop;
  execute 'reset role';
end $$;
rollback;
`;

const verifyContainment = `
begin;
do $$
declare t text; n bigint; blocked boolean;
begin
  execute 'set local role anon';
  foreach t in array array[${sqlList(tables)}] loop
    blocked := false;
    begin execute format('select count(id) from public.%I',t) into n;
    exception when insufficient_privilege then blocked := true; end;
    if not blocked then raise exception 'containment: anon can still read %',t; end if;
    if has_any_column_privilege('anon',format('public.%I',t),'SELECT,INSERT,UPDATE,REFERENCES') then
      raise exception 'containment: anon retains column access to %',t;
    end if;
  end loop;
  execute 'reset role';
  foreach t in array array[${sqlList(tables)}] loop
    if (select relrowsecurity from pg_class where oid=format('public.%I',t)::regclass) then
      raise exception 'containment unexpectedly changed RLS on %',t;
    end if;
  end loop;
  execute 'set local role authenticated';
  foreach t in array array[${sqlList(tables)}] loop
    execute format('select count(*) from public.%I',t) into n;
    if n <> 2 then raise exception 'containment changed authenticated row visibility on %',t; end if;
  end loop;
  execute 'reset role';
  execute 'set local role service_role';
  foreach t in array array[${sqlList(tables)}] loop
    execute format('select count(*) from public.%I',t) into n;
    if n <> 2 then raise exception 'containment changed service row visibility on %',t; end if;
  end loop;
  execute 'reset role';
  if not exists(select 1 from public.profiles where id='${a}' and user_id is null) then
    raise exception 'containment changed an unlinked owner';
  end if;
end $$;
rollback;
`;

try {
  const created = docker(["run", "--detach", "--pull=never", "--network", "none", "--memory", "256m", "--cpus", "1", "--label", `dev.codex.owner=${label}`, "--tmpfs", "/var/lib/postgresql/data:rw", "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:17"]);
  if (created.status !== 0) throw new Error(created.stderr || String(created.error));
  container = created.stdout.trim();
  assert.match(container, /^[a-f0-9]{64}$/);
  for (let attempt = 0; ; attempt++) {
    // The image's temporary initialization server only listens on its Unix
    // socket. TCP readiness waits for the final server, not that transient one.
    const ready = docker(["exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"]);
    if (ready.status === 0) break;
    if (attempt === 79) throw new Error("Disposable Postgres failed to start");
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  sql(fixture);
  const preflight = readFileSync(new URL("../docs/security/2026-10-21-rls-preflight.sql", import.meta.url), "utf8");
  const report = JSON.parse(sql(`begin read only;\n${preflight}\nrollback;`).stdout.trim());
  assert.equal(report.tables.length, 19);
  assert.equal(report.tables.filter(t => !t.rls_enabled).length, 19);
  assert.equal(report.profile_ownership.unlinked_profiles, 0);
  assert.equal(report.primary_owner_verified, null);
  assert.equal(report.child_ownership.length, 10);
  assert.equal(report.child_ownership.some(t => t.null_profile_ids || t.unmatched_profile_ids), false);
  const verifiedOwnerReport = JSON.parse(sql(`begin read only;\n${preflight.replace("values(null::uuid)", `values('${a}'::uuid)`)}\nrollback;`).stdout.trim());
  assert.equal(verifiedOwnerReport.primary_owner_verified, true);
  console.log("PASS: read-only preflight executes and reports all 19 fixture tables");
  const bundleIndex = process.argv.indexOf("--bundle");
  if (bundleIndex !== -1) {
    const bundledSql = readFileSync(process.argv[bundleIndex + 1], "utf8");
    const boundOwners = [...bundledSql.matchAll(/expected_primary_owner uuid := '([a-f0-9-]{36})';/gi)].map(match => match[1]);
    assert.equal(boundOwners.length, 2);
    assert.equal(new Set(boundOwners).size, 1);
    // Use a synthetic auth identity for this offline fixture, never production.
    const fixtureBundle = bundledSql.replaceAll(boundOwners[0], a);
    sql(`update public.profiles set user_id=null where id='${a}'; insert into public.profiles(id,handle) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','unmapped'); insert into public.posts(profile_id,payload) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','preserve_unmapped');`);
    const receipt = JSON.parse(sql(fixtureBundle).stdout.trim());
    assert.equal(receipt.tables_with_rls, 19);
    assert.equal(receipt.anon_accessible_tables, 0);
    assert.equal(receipt.authenticated_internal_access, 0);
    assert.equal(receipt.authenticated_admin_privileges, 0);
    assert.equal(receipt.primary_owner_verified, true);
    assert.equal(receipt.unlinked_profiles, 1);
    assert.equal(sql("select count(*) from public.posts where payload='preserve_unmapped';").stdout.trim(), "1");
    console.log("PASS: four-stage operator bundle with synthetic identity; primary linked, 19 tables protected, unlinked data preserved");
  } else if (process.argv.includes("--link-owner") || process.argv.includes("--red-owner-link")) {
    sql(`update public.profiles set user_id=null where id='${a}';`);
    if (process.argv.includes("--red-owner-link")) {
      assert.equal(sql(`select user_id is not distinct from '${a}'::uuid from public.profiles where id='${a}';`).stdout.trim(), "t", "primary owner is not linked");
    }
    const rawLink = readFileSync(new URL("../docs/security/2026-10-21-link-primary-owner.sql", import.meta.url), "utf8");
    const link = rawLink.replace("expected_primary_owner uuid := null;", `expected_primary_owner uuid := '${a}';`);
    sql(link);
    sql(link);
    assert.equal(sql(`select user_id='${a}'::uuid from public.profiles where id='${a}';`).stdout.trim(), "t");
    assert.equal(sql(`select user_id='${b}'::uuid from public.profiles where id='${b}';`).stdout.trim(), "t");
    console.log("PASS: primary owner link is correct/idempotent; other owner unchanged");
    for (const scenario of ["owner_missing", "unconfirmed", "wrong_existing_owner", "duplicate_handle"]) {
      sql(fixture);
      sql(`update public.profiles set user_id=null where id='${a}';`);
      sql({ owner_missing: "select 1;", unconfirmed: `update auth.users set email_confirmed_at=null where id='${a}';`, wrong_existing_owner: `update public.profiles set user_id='${b}' where id='${a}';`, duplicate_handle: "insert into public.profiles(handle) values('fcisco95');" }[scenario]);
      const refused = sql(scenario === "owner_missing" ? rawLink : link, true);
      assert.notEqual(refused.status, 0);
      assert.match(refused.stderr, /Primary owner link:/);
      assert.equal(sql(`select count(*) from public.profiles where id='${a}' and user_id='${a}';`).stdout.trim(), "0");
      console.log(`PASS: ${scenario} refuses primary link without reassignment`);
    }
  } else if (process.argv.includes("--containment") || process.argv.includes("--red-containment")) {
    sql(`update public.profiles set user_id=null where id='${a}';`);
    if (process.argv.includes("--red-containment")) sql(verifyContainment);
    const containment = readFileSync(new URL("../docs/security/2026-10-21-rls-containment.sql", import.meta.url), "utf8");
    sql(containment);
    sql(verifyContainment);
    sql(containment);
    sql(verifyContainment);
    console.log("PASS: containment blocks anon on 19 tables, preserves authenticated/service visibility and unlinked owner data, reruns safely");
    sql(fixture);
    sql("grant authenticated to anon;");
    const refused = sql(containment, true);
    assert.notEqual(refused.status, 0, "containment must refuse surviving inherited anon rights");
    assert.match(refused.stderr, /RLS containment:/);
    assert.equal(sql("select has_table_privilege('anon','public.profiles','SELECT');").stdout.trim(), "t", "failed containment partially changed privileges");
    console.log("PASS: unsafe inherited anonymous access refuses containment atomically");
    process.exitCode = 0;
  } else {
  if (process.argv.includes("--red")) {
    sql(verify);
    throw new Error("Baseline unexpectedly passed without recovery");
  }
  const rawRecovery = readFileSync(new URL("../docs/security/2026-10-21-rls-recovery.sql", import.meta.url), "utf8");
  const recovery = rawRecovery.replace("expected_primary_owner uuid := null;", `expected_primary_owner uuid := '${a}';`);
  sql(recovery);
  sql(verify);
  const postflight = readFileSync(new URL("../docs/security/2026-10-21-rls-verify.sql", import.meta.url), "utf8").replace("values(null::uuid)", `values('${a}'::uuid)`);
  const receipt = JSON.parse(sql(`begin read only;\n${postflight}\nrollback;`).stdout.trim());
  assert.equal(receipt.tables_with_rls, 19);
  assert.equal(receipt.anon_accessible_tables, 0);
  assert.equal(receipt.authenticated_internal_access, 0);
  assert.equal(receipt.authenticated_admin_privileges, 0);
  assert.equal(receipt.primary_owner_verified, true);
  console.log("PASS: 19 tables; anon blocked; 11 owner-scoped tables; 8 internal tables; cross-owner writes blocked; service CRUD preserved; profile default works");
  sql(recovery);
  sql(verify);
  console.log("PASS: rerun is idempotent even with an existing permissive allow-all policy");
  sql(fixture);
  sql(`insert into public.profiles(id,handle) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','unmapped'); insert into public.posts(profile_id,payload) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','preserve_unmapped');`);
  sql(recovery.replace("quarantine_unlinked_profiles boolean := false;", "quarantine_unlinked_profiles boolean := true;"));
  assert.equal(sql(`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${a}',true); select count(*) from public.profiles; select count(*) from public.posts; rollback;`).stdout.trim().split(/\r?\n/).slice(-2).join(","), "1,1");
  assert.equal(sql("select count(*) from public.profiles where user_id is null; select count(*) from public.posts where payload='preserve_unmapped';").stdout.trim().split(/\r?\n/).join(","), "1,1");
  console.log("PASS: explicit quarantine preserves unlinked profile/data while hiding them from owner sessions");
  const scenarios = ["unlinked", "orphaned", "missing_table", "bypass_role", "inherited_anon", "inherited_internal", "inherited_truncate", "wrong_default", "wrong_primary_owner", "expected_owner_missing", "child_owner_missing", "child_owner_case", "child_owner_orphan", "custom_role", "inherited_owner", "restrictive_policy", "inherited_authenticated", "inherited_maintain"];
  const failures = [];
  for (const scenario of scenarios) {
    sql(fixture);
    sql({
      unlinked: `insert into public.profiles(handle) values ('unlinked')`,
      orphaned: `update public.profiles set user_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc' where id='${a}'`,
      missing_table: "drop table public.posts",
      bypass_role: "alter role authenticated bypassrls",
      inherited_anon: "grant select on public.posts to legacy_reader; grant legacy_reader to anon;",
      inherited_internal: "grant select on public.signal_tweets to legacy_reader; grant legacy_reader to authenticated;",
      inherited_truncate: "grant truncate on public.posts to legacy_reader; grant legacy_reader to authenticated;",
      wrong_default: `alter table public.profiles alter column user_id set default '${b}'::uuid;`,
      wrong_primary_owner: `update public.profiles set user_id='${b}' where id='${a}';`,
      expected_owner_missing: "select 1;",
      child_owner_missing: "update public.research_briefings set profile_id=null where payload='owner_a';",
      child_owner_case: `update public.research_briefings set profile_id='${a.toUpperCase()}' where payload='owner_a';`,
      child_owner_orphan: "update public.research_briefings set profile_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc' where payload='owner_a';",
      custom_role: "create role custom_api; grant select on public.posts to custom_api;",
      inherited_owner: "grant postgres to anon;",
      restrictive_policy: "create policy legacy_restriction on public.posts as restrictive using(false);",
      inherited_authenticated: "grant authenticated to anon;",
      inherited_maintain: "grant pg_maintain to authenticated;",
    }[scenario]);
    try {
      const refused = sql(scenario === "expected_owner_missing" ? rawRecovery : recovery, true);
      assert.notEqual(refused.status, 0, `${scenario} must refuse recovery`);
      assert.match(refused.stderr, /RLS recovery preflight:/, `${scenario}: unexpected failure`);
      const enabled = sql("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity;");
      assert.equal(enabled.stdout.trim(), "0", `${scenario} partially changed RLS`);
      console.log(`PASS: ${scenario} preflight refuses changes atomically`);
    } catch (error) { failures.push(error.message); }
  }
  assert.deepEqual(failures, [], "unsafe recovery scenarios must all refuse atomically");
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
      else console.log("CLEANUP: only the owned, network-isolated disposable container removed");
    } else { console.error("Cleanup refused: container ownership label mismatch"); process.exitCode = 1; }
  }
}
