# Embalio revamp — interview-driven re-plan (2026-10-21)

## Context

Embalio is João's X growth-operator app (Next 16.2.6 / Supabase / Vercel Hobby). The Q3 plan
(GATE-2: "do assisted replies move reach?") expired 2026-09-04 with **zero owner-loop
iterations**: 0 manual pastes, 0 outcomes recorded, 0 CSV imports since June. Three decisions
sat parked since 2026-09-10 (GATE-2 close-out, Campaign Mode sign-off, concierge multi-profile).
Auth is on `main` since #5 (2026-09-09).

João's brief this session: stop assuming the old plan; rethink with what exists now (new models,
skills, connectors, official APIs). Start with him as the single operator of 3–5 accounts (his +
1–2 clients), no time to run them by hand; he wants a phone-friendly "AI-suggested post → review →
edit → publish" loop per account, analytics, account switching, niche research and engagement
targets. Architect so handing it to other operators later is simple, but build for one user now.

## Interview outcomes (3 rounds, AskUserQuestion)

| Topic | Decision | Analyst note |
|---|---|---|
| GATE-2 | Rethink from scratch; don't inherit the plan | Close NOT RUN in one ledger line; the new gate below replaces it |
| Surface | **Hybrid: skills generate, app shows** | Matches revealed preference (tweets drafted in Claude sessions in Jul, not in the app) |
| X data | Own scraper or X API; Grok paid until ~end Nov; experiment, then pay more if it works | Own scraper = no (facts §3). X API is pay-per-use now, cheap at this scale |
| Accounts | 3–5: his + 1–2 clients, niches mixed/unknown | Concierge model (clients never log in). Target exclusivity enforced in the DB |
| Publish | **API for approved originals, intent URL for replies** | Unfreezes API write for originals only. Caps stay. API replies stay off |
| Ritual | **Both: morning approval (phone), evening replies (desktop)** | Analyst flagged two new habits at once; owner reaffirmed. Build both; morning first, evening unlocks after 14 straight morning days |
| Success (30d) | **Consistency gate, reach as read-out** | See "The new gate" |
| Access today | X Developer account ✓, client logins ✓, no xAI API key | xAI key = 5-min signup; X API spend earns xAI credits back when linked |
| Engine runtime | "Free, easiest, best results — your call" | **GitHub Actions + `claude -p`** (already proven in-repo). Fallback: Claude scheduled cloud routine |
| Voice | **Agentic setup wizard**: no file imports; pull the account's posts, interview the user, show "you get more reach on X", define the persona, keep learning from approved/edited posts | v1 = Claude Code skill (`/embalio-onboard`); v2 = same agent in-app for clients |
| Legacy surfaces | **Hide from nav, don't delete** | Nav → Hoje · Replies · Performance · Contas; rest under Labs (URL-only) |

## Facts verified this session (these invalidate old-plan assumptions)

1. **X API is pay-per-use, no monthly fee** (docs.x.com pricing, 2026-10-21): post read $0.005,
   own-posts read $0.001, user read $0.010, post create $0.015 (**$0.200 if the text has a URL**).
   $20 + up to $50 starter credits; 3M reads/month cap. Legacy Basic/Pro are gone.
2. **xAI `x_search`** (docs.x.ai): $5 / 1k posts, $10 / 1k profiles, billed per item. Official path
   for niche discovery and lane scans. Consumer SuperGrok ≠ API credits.
3. **Own scraper: no.** twscrape/twikit need account cookies, break on GraphQL changes every few
   weeks, carry suspension risk on the account used; Nitter got a C&D (Aug 2026). Apify is the same
   scraper with the risk moved. Official API at $0.005/post beats both.
4. **ToS multi-account**: up to 10 accounts for distinct purposes is allowed; several accounts
   engaging the same content is prohibited. Guardrail must be structural (DB), not a warning.
5. **Vercel Hobby cron = once per day, ±59 min** → useless for "post at 09:00". pg_cron + pg_net on
   Supabase free tier is precise. GitHub Actions schedules lag 10–30 min.
6. **`refresh-topics` Action runs `claude -p` headless and is green** (6 runs to 2026-10-20 21:48Z,
   auth `CLAUDE_CODE_OAUTH_TOKEN`). The nightly engine copies this file.
7. **Codebase**: approve→publish exists but is unreachable (`post-button.tsx` imported by no page);
   `posting_jobs.method` only allows `adspower` (needs a local desktop app); no `scheduled_at`;
   every page uses `listProfiles()[0]` (no cookie, mock switcher); `FIXED_PROFILE_ID` still guards
   ~15 call sites though RLS + auth now scope data; `assertOwnProfile` already exists in
   `src/server/auth.ts`; PWA is push-only (`sw.js` no fetch handler, registered only on `/engage`);
   `SignalSource` seam in `src/lib/signals/types.ts` with `apify` live and `twitterapi`/`grok` stubs;
   voice fields (`voice_spec`, `voice_corpus`, `content_pillars`, `onboarding_answers`) on `profiles`
   via `save_persona` RPC; prompt builders in `src/lib/voice-prompt.ts`.
8. **Rule for engine code**: nothing under `src/lib/x-api/`, `src/lib/signals/`, `scripts/` may import
   `@/lib/supabase/server` (pulls `next/headers`); pass a `SupabaseClient<Database>` in.

## Approach

### One-line vision
A phone-first approval queue over Supabase that Claude Code skills fill every night (drafts with a
stated angle, reply targets, reach read-outs) from the official X API and xAI `x_search`; approved
originals publish via each account's own X OAuth; replies open X's composer. One operator, 3–5
accounts, ~10 min each morning.

### The new gate (replaces GATE-2)
- **Consistency gate (judged day 30):** ≥21 of 30 days with ≥1 published post per managed account,
  counted from `posts.posted_at`; shown as a card on Performance.
- **Reach read-out (not a gate):** weekly impressions + followers per account via API, automatic,
  vs the prior 4 weeks.
- **Tripwire day 14:** <10 publish days on João's own account → stop building UI; the finding is
  "the operator does not open a separate app"; next move is approval inside Telegram/push.
- **Ledger:** one line in `docs/GOAL-LOG.md` closes GATE-2 as NOT RUN; `.claude/commands/goal.md` retired.

### Lanes (file-ownership domains; one owner per file)

| Lane | Scope | Owns |
|---|---|---|
| **A — X backbone** | OAuth PKCE per account · publish worker · queue Server Actions | `src/lib/x-api/*`, `src/app/api/x/**`, `src/server/{x-accounts,publish,queue-actions,posts}.ts`, `src/lib/posting/link-rule.ts`, `src/app/api/cron/publish-due/`, `src/components/{profile-card,approval-queue,x/connect-x-button}.tsx`, `src/lib/auth/session-gate.ts`, `src/lib/cron-auth.ts` |
| **B — App surface** | active-profile cookie + switcher · every page · nav · PWA · retire `FIXED_PROFILE_ID` | `src/server/active-profile*.ts`, `src/lib/auth/active-profile.ts`, all `(app)/**/page.tsx` + `layout.tsx`, `components/shell/*`, `src/server/{kpis,predict,topics,weekly-activity,push-subscriptions,strategy,sniper-actions,briefing,consistency}.ts`, `api/{pulse,nudge,telegram}`, `setup/page.tsx`, `src/app/manifest.ts`, `public/sw.js`, `push-opt-in.tsx` |
| **C — Targets + signals** | exclusive allocation · `xapi` SignalSource | `src/lib/targets/*`, `src/lib/signals/*`, `src/server/{targeting,sniper}.ts`, `api/cron/signal-retention` |
| **D — Read-out** | own-post impressions, followers → tables | `src/lib/x-api/readout.ts`, `api/cron/readout`, `scripts/readout.ts`, `.github/workflows/readout.yml`, `vercel.json`; deletes `follower-snapshot` route + server file |
| **E — Agent engine** | skills: onboard wizard · nightly drafts · targets · weekly note | `.claude/skills/**`, `scripts/nightly-*.ts`, `.github/workflows/nightly-*.yml`, `src/lib/voice-prompt.ts`, `src/lib/generate/**` |
| **F — Ledger/hygiene** | GATE-2 close · retire `/goal` · handoff | `docs/**`, `.claude/commands/goal.md`, existing paused workflow files |

Carve-outs that make ownership disjoint: `posts.ts` → A (C exposes `releaseTarget`, A adds the one-line
call in `dismissCandidate`); wiring `approval-queue.tsx` into pages → B (A ships the component only);
`follower-snapshot` files → D only. `src/lib/supabase/types.ts` and all migrations are written once
on Day 0, then frozen unless A broadcasts.

### Day 0 contract (serial, one PR, before any lane starts)
- `src/lib/x-api/types.ts` — `XClient` interface (`createTweet`, `getMe`, `getUserTweets`, `searchRecent`, `getTweet`, `estimatedCostUsd`); lanes C/D/E mock it until A lands.
- `src/lib/signals/types.ts` — `SignalSourceId += "xapi"`; `pullAuthorTweets(handles, {maxPerHandle?, profileId?})`.
- Five migrations (SQL in Technical design): `20261021_x_accounts`, `20261021_publish_xapi`, `20261021_target_allocations`, `20261021_signal_cursors`, `20261021_readout`. Reflect once in `src/lib/supabase/types.ts`.
- Lane F items (GATE-2 line, retire `/goal`).

### Sequencing
| Slice | Content | Lanes (parallel worktrees) | Effort | Unlocks |
|---|---|---|---|---|
| 0 | Day-0 contract · nav hide + Labs · GATE-2 close · retire `/goal` | F, B(nav only) | ½ session | Parallel work |
| 1 | A (connect João's X, publish approved/scheduled) ‖ B (switcher, Hoje queue, page sweep, `FIXED_PROFILE_ID` retirement) ‖ E2 (nightly drafts for João) | A ‖ B ‖ E | 2–3 sessions | **Day 1 of the 30 on João's account** |
| 2 | E1 wizard → add client accounts ‖ B PWA + morning push ‖ D read-out + Performance gate card ‖ E4 weekly note | B ‖ D ‖ E | 2 sessions | All accounts in the loop; gate visible |
| 3 (after 14 straight morning days) | C allocation + `xapi` ‖ E3 targets skill; `/engage` pins via `xapi`; replies by intent | C ‖ E | 1–2 sessions | Evening ritual |
| post-30 | In-app wizard for clients · operator roles · Stripe | — | — | Selling it |

Integration order per slice: **B → A → C → D → E**, `npm test` green on each merge (trunk policy unchanged). Only A and D need live X credentials for an end-to-end check.

### Owner queue (nothing below is agent-doable)
1. X Developer portal: create/confirm an OAuth 2.0 app (confidential client), add callback URLs for prod + `http://localhost:3000`, copy `X_CLIENT_ID`/`X_CLIENT_SECRET`, add a card + buy starter credits.
2. Generate `X_TOKEN_ENC_KEY` (32 random bytes, base64) → Vercel env + GitHub secret.
3. xAI: create an API key at console.x.ai, link the X API team for the credit-back.
4. Supabase SQL editor: enable `pg_cron` + `pg_net`, store `CRON_SECRET` in Vault, schedule `publish-due` every 5 min (SQL in Technical design §2). Apply the five migrations.
5. Link each X account on `/profiles` (private window per account).
6. Run `/embalio-onboard` once per account (interview, ~10 min each).

### Costs (monthly, 3 accounts)
| Item | Est. |
|---|---|
| X API reads (search `since_id` + weekly owned reads) | $5–15 |
| X API posts: 3 × ~1/day × $0.015 + ~20 link replies × $0.20 | $7–10 |
| xAI `x_search` (nightly lane scan + discovery) | $5–10 |
| GitHub Actions (public repo), Vercel Hobby, Supabase free, Claude via subscription | $0 |
| **Total** | **~$20–35**; month 1 mostly covered by X starter credits |

### Risks the owner should hear first
1. **The product never failed; the habit did.** Everything here lowers friction; only the day-14 tripwire forces honesty. [Certain]
2. **Multi-account coordination ends the project.** Allocation is DB-enforced (trigger); the wizard must also refuse near-identical pillars across accounts without a human note. [Certain]
3. **X pay-per-use is young** (2026); a 2× price move stays <$40 because reads are incremental. [Likely]
4. **Linking client accounts** = their X login in João's browser + accepting a third-party app. Fine for 1–2 clients, not a sales flow. [Certain]
5. **`claude -p` in Actions bills the subscription**; if headless billing changes, move the engine to a cloud routine or Agent SDK (~$5–15/mo at this volume). [Guessing on timing]
6. **Read-out semantics**: summing impressions of posts by post-day ≠ X's "impressions that day". Label it; keep CSV authoritative where both exist. [Certain]

## Technical design (Plan agent, reviewed)

### §1 X account connection (OAuth 2.0 PKCE, user context) — Lane A
**Create** `supabase/migrations/20261021_x_accounts.sql`; `src/lib/x-api/{types,crypto,oauth,client}.ts`; `src/app/api/x/oauth/{start,callback}/route.ts`; `src/server/x-accounts.ts`.
- `crypto.ts`: `encryptSecret(plain)`, `decryptSecret(blob)` — AES-256-GCM via `node:crypto`, key `X_TOKEN_ENC_KEY` (base64, 32 B), blob `v1.<iv>.<tag>.<ct>` base64url, random 12-B IV; throws on missing key/tag failure.
- `oauth.ts`: `X_SCOPES = ["tweet.read","tweet.write","users.read","offline.access"]`, `makePkce()`, `buildXAuthUrl({clientId, redirectUri, state, challenge})` → `https://x.com/i/oauth2/authorize`, `exchangeCode({code, verifier, redirectUri})`, `refreshTokens(refreshToken)` → `https://api.x.com/2/oauth2/token` with `Authorization: Basic base64(id:secret)`.
- `client.ts`: `getXClientForProfile(profileId, sb): Promise<XClient>` — decrypt, pre-emptive refresh when `access_expires_at < now()+5min` or on 401 (one retry). **Rotation lock**: `UPDATE x_accounts SET … token_version = token_version+1 WHERE profile_id=? AND token_version=?`; 0 rows → re-read. `invalid_grant` → `needs_reauth=true`, throw `XReauthRequired`. 429 → `XRateLimited(resetAt)`.
- `start/route.ts` (`GET ?profile=`): `requireSessionUser()` + `assertOwnProfile(profileId)` (both exist in `src/server/auth.ts`); HttpOnly cookie `x_oauth` = `{state, verifier, profileId}` (`path:/api/x/oauth`, `maxAge:600`, same shape as `src/app/api/youtube/oauth/start/route.ts`); redirect with `code_challenge_method=S256`.
- `callback/route.ts`: constant-time state check (export `safeEqual` from `src/lib/cron-auth.ts`), `exchangeCode`, `GET /2/users/me`, **re-run `assertOwnProfile(cookie.profileId)`** against the live session, upsert via `supabaseService()`; `23505` on `x_user_id` → `/profiles?x=already-linked`.
- `x-accounts.ts` (`"use server"`): `getXAccountStatus(profileId)` (non-secret columns), `disconnectXAccount(profileId)` (revoke + delete).
- **Modify** `src/lib/auth/session-gate.ts` `isProtectedPath` += `/api/x/`; `src/components/profile-card.tsx` gains the X row + **Connect X** link. UX copy: "Open in a private window logged into *this client's* X account, then authorize." Callback echoes `@username` on the card; `x_user_id UNIQUE` blocks double-linking; Disconnect undoes mistakes.
- **Env**: `X_CLIENT_ID`, `X_CLIENT_SECRET`, `X_TOKEN_ENC_KEY`.

```sql
create table public.x_accounts (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  x_user_id text not null unique, x_username text not null,
  access_token_enc text not null, refresh_token_enc text not null,
  access_expires_at timestamptz not null, scopes text not null,
  token_version int not null default 0, needs_reauth boolean not null default false,
  last_refresh_at timestamptz, last_error text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.x_accounts enable row level security;
revoke all privileges on table public.x_accounts from anon, authenticated;
```
**Tests first**: `src/lib/x-api/{crypto,oauth,client}.test.ts`, `src/app/api/x/oauth/callback/route.test.ts` (state mismatch 403; foreign profile 403; happy path encrypted + cookie cleared; conflict redirect).

### §2 Publish path — Lane A
**Create** `supabase/migrations/20261021_publish_xapi.sql`, `src/server/publish.ts` (service role, plain module), `src/lib/posting/link-rule.ts`, `src/server/queue-actions.ts` (`"use server"`), `src/app/api/cron/publish-due/route.ts`, `src/components/approval-queue.tsx` (mobile-first; replaces unreachable `post-button.tsx`). **Modify** `src/server/posts.ts listPendingDrafts` (add `"scheduled"`, select `scheduled_at, angle, rationale, link_url`).

```sql
alter table public.drafts add column if not exists scheduled_at timestamptz,
  add column if not exists angle text, add column if not exists rationale text,
  add column if not exists link_url text;
alter table public.drafts drop constraint drafts_status_check;
alter table public.drafts add constraint drafts_status_check
  check (status in ('draft','approved','scheduled','posted','skipped','unconfirmed'));
alter table public.drafts add constraint drafts_scheduled_needs_time
  check (status <> 'scheduled' or scheduled_at is not null);
create index if not exists drafts_due_idx on public.drafts (scheduled_at) where status = 'scheduled';
alter table public.posting_jobs drop constraint posting_jobs_method_check;
alter table public.posting_jobs add constraint posting_jobs_method_check check (method in ('adspower','xapi'));
alter table public.posting_jobs add column if not exists reply_result_url text;
alter table public.posts add column if not exists tweet_id text, add column if not exists link_tweet_url text;
update public.posts set tweet_id = substring(tweet_url from '/status/(\d+)') where tweet_id is null and tweet_url is not null;
create unique index if not exists posts_profile_tweet_id_uidx on public.posts (profile_id, tweet_id) where tweet_id is not null;
```
- `publishDraft(draftId, sb = supabaseService(), xFor = getXClientForProfile)` mirrors `postDraft` in `src/server/posting.ts`: refuse `kind='reply'`/empty/wrong status → insert `posting_jobs {method:'xapi', status:'running'}` (`23505` on `posting_jobs_active_draft_uidx` = idempotency key) → `x.createTweet({text})` → insert `posts {tweet_url, tweet_id}` → draft `posted`, candidate `engaged`, `logActivity` → if `link_url`: second `createTweet` as reply ($0.200; failure leaves draft `posted`, job `succeeded` with error) → catch: `tweetSent ? 'needs_manual_confirmation' : 'failed'`; ≥3 failed jobs → draft back to `approved`.
- `link-rule.ts`: `bodyHasUrl(text)`, `extractTrailingLink(body) → {text, link_url}` (pure; used at approve time and by the nightly skill so URLs never ride in the main body).
- Server Actions (RLS via `supabaseServer()`): `approveAndSchedule(draftId, scheduledAt|null)` (null → inline `publishDraft`), `editDraftBody(draftId, body)` (280 or long-form if `profiles.premium_account`), `skipDraft`, `unscheduleDraft`; all `revalidatePath`.
- `/api/cron/publish-due`: `cronAuthError`, `maxDuration=60`, `supabaseService()`, `status='scheduled' and scheduled_at <= now() order by scheduled_at limit 10`, per-draft try/catch, returns counts + `estimatedCostUsd`.
- **Trigger (decided)**: **Supabase pg_cron + pg_net every 5 min → `publish-due`** + inline publish on "post now". Keep `.github/workflows/publish-due.yml` as `workflow_dispatch`-only fallback. One-time owner SQL (not committed):
```sql
select vault.create_secret('<CRON_SECRET>', 'cron_secret');
select cron.schedule('publish-due', '*/5 * * * *', $$
  select net.http_post(url := 'https://<app-host>/api/cron/publish-due',
    headers := jsonb_build_object('Authorization', 'Bearer ' ||
      (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    timeout_milliseconds := 55000); $$);
```
**Tests first**: `src/server/publish.test.ts` (mock style of `posting.test.ts`), `src/lib/posting/link-rule.test.ts`, `src/server/queue-actions.test.ts`, `src/app/api/cron/publish-due/route.test.ts`.

### §3 Active-profile resolver + switcher + `FIXED_PROFILE_ID` retirement — Lane B
- **Create** `src/lib/auth/active-profile.ts` (pure `resolveActiveProfile(profiles, cookieId)`), `src/server/active-profile.ts` (`ACTIVE_PROFILE_COOKIE="embalio_profile"`, `getActiveProfile = cache(...)`, `requireActiveProfile()` → redirect `/setup`), `src/server/active-profile-actions.ts` (`setActiveProfile(profileId)`: `assertOwnProfile` → `cookies().set(...)` → `revalidatePath("/", "layout")`; Next 16 cookie writes in Server Actions re-render page + layouts, no `router.refresh()` needed).
- **Modify** `(app)/layout.tsx` → `Promise.all([listProfiles(), requireActiveProfile()])` → `AppShell` → `Topbar` → real `AccountSwitcher` (props replace `BRAND` mock, `useTransition`). Pages `(app)/page`, `board`, `compose`, `topics`, `engage`, `plan`, `performance/*`: `listProfiles()[0]` → `await requireActiveProfile()`. Drop `?profile=`. Repoint `studio/page.tsx` + `youtube/oauth/callback` from `studio/recording-profiles.ts`'s `getActiveProfile` to `@/server/active-profile`.
- **Retire `FIXED_PROFILE_ID`**: `assertFixedProfileAccess(id)` → `await assertOwnProfile(id)` at `kpis.ts`, `predict.ts`, `topics.ts`, `weekly-activity.ts`, `push-subscriptions.ts`, `strategy.ts` (`getStrategyBoard`, `applyTargetRecommendation`), `sniper-actions.ts`. **Exception**: `strategy.ts runWeeklyStrategy` is called by `/api/cron/strategy` without a session → delete the guard there. `briefing.ts` make `profileId` required; `api/{pulse,nudge,telegram/poll}` take `?profile=` or iterate profiles under cron bearer; `setup/page.tsx` drop `setupBlockedByPinnedProfile`; delete `src/lib/auth/pinned-profile.ts(+test)`, `unlinked-account-notice.tsx`, then `src/server/fixed-profile.ts`.
- **Hoje** (`(app)/page.tsx`): render `approval-queue.tsx` per account (draft · angle · rationale · suggested time · Approve / Edit / Schedule / Skip) above a slim status row; move the 7-read dashboard pieces to Performance. Nav (`nav-items.ts`): Hoje · Replies · Performance · Contas; Labs group hidden from `bottom-nav`.
- **PWA**: register `sw.js` in `(app)/layout.tsx`; add fetch handler (network-first, offline shell); `manifest.ts` `start_url:"/"`, `id`, `scope`, maskable 192/512 icons; `appleWebApp` metadata; `h-dvh` + top safe-area in `app-shell.tsx`/`topbar.tsx`; `push-opt-in.tsx` surfaced on Hoje; morning push "a tua fila está pronta" from the nightly job via `src/lib/notify.ts`.
- `src/server/consistency.ts`: `getConsistencyGate(profileId, days=30)` → `{publishDays, target:21, perAccount[]}` from `posts.posted_at`; card on Performance.
**Tests first**: `active-profile.test.ts` (pure), `active-profile.test.ts` (server, mock `next/headers`), `active-profile-actions.test.ts` (foreign profile throws before cookie), rewrite `sniper-actions.test.ts` to mock `assertOwnProfile`, `consistency.test.ts`.

### §4 Exclusive target allocation — Lane C
```sql
create table public.target_allocations (
  source_tweet_id text primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  allocated_by text not null default 'agent' check (allocated_by in ('agent','sniper','manual')),
  allocated_at timestamptz not null default now());
create index on public.target_allocations (profile_id, allocated_at desc);
alter table public.target_allocations enable row level security;
revoke all privileges on table public.target_allocations from anon, authenticated;
create or replace function public.enforce_target_allocation() returns trigger language plpgsql as $$
declare owner uuid; begin
  insert into public.target_allocations (source_tweet_id, profile_id, allocated_by)
  values (new.source_tweet_id, new.profile_id, tg_argv[0]) on conflict (source_tweet_id) do nothing;
  select profile_id into owner from public.target_allocations where source_tweet_id = new.source_tweet_id;
  if owner <> new.profile_id then raise exception 'target % allocated to another profile', new.source_tweet_id using errcode = '23505'; end if;
  return new; end $$;
create trigger candidates_target_alloc before insert on public.candidates for each row execute function public.enforce_target_allocation('agent');
create trigger sniper_alerts_target_alloc before insert on public.sniper_alerts for each row execute function public.enforce_target_allocation('sniper');
insert into public.target_allocations (source_tweet_id, profile_id, allocated_by)
select distinct on (source_tweet_id) source_tweet_id, profile_id, 'agent' from public.candidates order by source_tweet_id, pulled_at on conflict do nothing;
```
- `src/lib/targets/allocation.ts`: `claimTargets(sb, profileId, ids, by) → Set<granted>`, `claimTarget(...) → {ok} | {ok:false, ownerProfileId}`, `releaseTarget(sb, profileId, id)`.
- **Modify** `targeting.ts scanTargetsForProfile` (pre-claim after `rankCandidates`, filter before upsert), `sniper.ts runSniperPoll` (claim after `seen` filter) + `createManualAlert` (taken → `{ok:false, reason:"already allocated to @handle"}`); `markSniperAlert(...,'dismissed')` and `dismissCandidate` (A adds the call) → `releaseTarget`. Sweep stale allocations (>14 d, no `posts`) in `signal-retention`.
**Tests first**: `allocation.test.ts`, extend `targeting.test.ts` + `sniper.test.ts`, integration `target-allocation.integration.test.ts` under `RUN_RLS_INTEGRATION=1`.

### §5 `xapi` SignalSource — Lane C
- `supabase/migrations/20261021_signal_cursors.sql`: `signal_cursors (key text pk, since_id text not null, updated_at)`; key `${profile_id}:xapi:${sha256(sorted handles).slice(0,16)}`; RLS on, revoke anon/authenticated.
- `src/lib/signals/xapi-source.ts` `makeXapiSource({profileId, sb, xFor?})`: `pullAuthorTweets` chunks `(from:a OR from:b …) -is:retweet -is:reply` ≤512 chars → `GET /2/tweets/search/recent` (`tweet.fields=public_metrics,created_at,author_id,entities`, `expansions=author_id`, `user.fields=public_metrics,username`, `since_id` or `start_time=now-24h`, ≤2 pages); advance cursor to `meta.newest_id` only on success. Map → `CandidateInput` (`views = public_metrics.impression_count ?? 0`, `authorFollowers = user.public_metrics.followers_count`, `raw={tweet,user}`). `pullTweetMetrics(url)` via `tweetIdFromUrl` + `GET /2/tweets/:id`.
- **Modify** `signals/index.ts getSignalSource(ctx?)`; call sites pass ctx at `targeting.ts`, `sniper.ts`.
**Tests first**: `xapi-source.test.ts`, extend `index.test.ts`. Risk: `search/recent` = 7 days, public accounts only.

### §6 Weekly read-out — Lane D
- `supabase/migrations/20261021_readout.sql`: `follower_snapshots.source` CHECK += `'api'`; `analytics_daily += api_updated_at timestamptz`.
- `src/lib/x-api/readout.ts` `runReadout(sb, profileId, {days=7})`: `getMe` → `follower_snapshots` upsert (`source:'api'`, same shape as `captureFollowerSnapshot`); `getUserTweets(x_user_id, {start_time, max_results:100, exclude: replies,retweets})` ($0.001 each) → match `posts.tweet_id` → `applyPostMetrics` (same zod shape as `updatePostMetrics`, which is `"use server"` and cannot be called here); unknown tweets inserted as `posts {draft_id:null, tweet_id, posted_at, metrics}`; daily sums → **`analytics_daily` upsert with only** `impressions, likes, replies, reposts, bookmarks, engagements, api_updated_at` (PostgREST updates only body keys → `profile_visits`, `new_follows`, `imported_at` untouched).
- `api/cron/readout` iterates `x_accounts where needs_reauth=false`; `vercel.json` cron `30 7 * * *` replaces `follower-snapshot`; `scripts/readout.ts` + `readout.yml` (`workflow_dispatch` + daily) for the Actions path. Delete `api/cron/follower-snapshot` + `src/server/follower-snapshot.ts(+test)`.
**Tests first**: `readout.test.ts` (mapping, UTC grouping, upsert keys exclude CSV columns, unknown tweet insert, `needs_reauth` skipped), `api/cron/readout/route.test.ts`.

### §7 Agent engine skills — Lane E (new; not in the Plan agent's scope)
All run via `claude -p` from `scripts/nightly-*.ts` (copy `scripts/refresh-topics.ts`: own service-role client, loop profiles) in `.github/workflows/nightly-*.yml` (copy `refresh-topics.yml`); the same skill runs locally with `/embalio-…`.
- **E1 `embalio-onboard`** (`.claude/skills/embalio-onboard/SKILL.md`): input `@handle` + `profile_id`; pull last ~200 own posts via `XClient.getUserTweets` (~$0.20–1.00); cluster by topic (LLM), compute impressions-by-topic → `profiles.reach_insights jsonb` (add column in Day-0 contract); interview with AskUserQuestion (what you enjoy, what this account is for, taboos, cadence, 2–3 example posts you admire); write `voice_spec`, `content_pillars`, `niche_description`, `onboarding_answers` via `save_persona`; refuse near-identical pillars to another managed profile without a human note. Re-runnable; replaces `/setup` quiz for v1.
- **E2 `embalio-nightly`** (02:00 Lisbon): per profile with `voice_spec` → lane scan (xAI `x_search` via `src/lib/engine/xsearch.ts` + WebSearch, Apify-free) → 1–3 original drafts via `buildOriginalPrompt`/`buildVoiceSystemFromSpec`, each with `angle`, `rationale`, `link_url` (via `extractTrailingLink`), `scheduled_at` suggestion = best hour from own-post history → insert `drafts {kind:'original', status:'draft'}` with the service client → 07:30 push/Telegram via `src/lib/notify.ts`. Net-new angles only (Jun lesson: never rephrase the owner's own posts).
- **E3 `embalio-targets`** (evening, slice 3): candidates from `xapi` watch targets + `x_search` lane → `targetScore` → `claimTargets` → `sniper_alerts` with reply drafts via `buildReplyDraftPrompt`; niche-account discovery (`x_search` profiles in the account's follower band) → suggested `watch_targets`.
- **E4 `embalio-weekly-readout`**: calls `runReadout` for each account, writes a short note (consistency days, impressions vs prior 4 weeks, top post) to `strategy_snapshots` or a new `readout_notes`; surfaces on Performance.
- Env for Actions: `CLAUDE_CODE_OAUTH_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `X_CLIENT_ID/SECRET`, `X_TOKEN_ENC_KEY`, `XAI_API_KEY`.
**Tests first**: pure helpers only (`src/lib/engine/*.test.ts`: best-hour, topic clustering shape, draft insert payload); skills themselves verified by one dispatched run per profile.

### §8 Ledger/hygiene — Lane F (slice 0)
- `docs/GOAL-LOG.md`: one entry "GATE-2 closed NOT RUN 2026-10-21; replaced by the 30-day consistency gate (this plan)".
- Delete `.claude/commands/goal.md`; add `docs/superpowers/plans/2026-10-21-revamp-plan.md` (this file, trimmed) and refresh `docs/HANDOFF.md`.
- `vercel.json`: remove the three Apify crons (`targeting`, `tracking`, `follower-snapshot`); keep paused workflows paused.

## Verification
- After each slice: `npm test` (baseline 845 pass / 1 skip), `npx tsc --noEmit`, `npm run build`.
- **Slice 1 end-to-end (João's account)**: `gh workflow run nightly-drafts.yml` → drafts with `angle`/`rationale` appear on Hoje on a phone → Approve (now) → `posting_jobs {method:'xapi', status:'succeeded'}` → tweet live on x.com → `posts.tweet_id` set → draft `posted`. Then Schedule (+10 min) → pg_cron fires → same chain. A draft with a trailing URL → main tweet clean, reply 1 carries the link.
- **Switcher**: cookie set → every page shows the chosen account; a profile id not owned by the session user is rejected; `FIXED_PROFILE_ID` grep returns zero hits in `src/`.
- **Allocation**: `RUN_RLS_INTEGRATION=1` test: second profile's insert of the same `source_tweet_id` raises 23505; `createManualAlert` returns the "already allocated" reason.
- **Read-out**: run `api/cron/readout` → `analytics_daily.impressions` written, `profile_visits` unchanged on existing rows; `follower_snapshots` has an `api` row; Performance gate card shows publish days.
- **Day 14 / day 30**: read the gate card, not a spreadsheet. Tripwire decision recorded in `docs/GOAL-LOG.md`.
