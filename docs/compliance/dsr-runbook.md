# DSR runbook — signal warehouse (GDPR LIA §5 R3)

**Scope:** requests from holders of watched X/Twitter accounts (`watch_targets`) about data in
`signal_tweets`, `tweet_metric_snapshots`, and `sniper_alerts`.
**Contact route:** cisco.vieira25@gmail.com (published at https://embalio.vercel.app/privacy).
**Deadline:** respond within 30 days of receiving a request (Art. 12(3)).

All SQL below runs against the production Supabase project `vzxpakxjnuaesfxihyvl`
(SQL editor or Supabase MCP). Replace `HANDLE` with the requester's handle, no `@`,
matching case-insensitively.

---

## 1. Verify the requester

The data subjects are public-account holders, so verification is light: the request must come
from a channel that demonstrates control of the account — a DM/reply from the account itself,
or an email referencing a post only the account holder would plausibly send. When in doubt, ask
them to post or DM a short confirmation from the account. Do not demand ID documents for
public-tweet data (proportionality, Art. 12(6)).

## 2. Access request (Art. 15)

Export everything held about the handle and send it to the requester:

```sql
select 'watch_targets' as src, to_jsonb(w) as row
  from watch_targets w where lower(w.handle) = lower('HANDLE')
union all
select 'signal_tweets', to_jsonb(s)
  from signal_tweets s where lower(s.author_handle) = lower('HANDLE')
union all
select 'sniper_alerts', to_jsonb(a)
  from sniper_alerts a where lower(a.author_handle) = lower('HANDLE');
```

Include in the reply: the categories collected, purpose, legal basis (legitimate interest),
the 90-day retention rule, and their objection/erasure rights (mirror the /privacy page).
Note: `tweet_metric_snapshots` has no handle column — its rows belong to `signal_tweets`
via FK and are covered by the parent rows in the export.

## 3. Objection (Art. 21) or erasure (Art. 17)

For this warehouse the response to both is the same — stop collecting and delete. There is no
compelling ground to continue over an objection (the interest is convenience-level ranking).

**Step 1 — stop collection** (prevents the next poll re-warehousing them):

```sql
update watch_targets set active = false where lower(handle) = lower('HANDLE');
```

**Step 2 — purge stored data** (`tweet_metric_snapshots` cascade-deletes with its parent):

```sql
delete from sniper_alerts where lower(author_handle) = lower('HANDLE');
delete from signal_tweets where lower(author_handle) = lower('HANDLE');
```

**Step 3 — verify zero rows remain:**

```sql
select
  (select count(*) from signal_tweets  where lower(author_handle) = lower('HANDLE')) as tweets,
  (select count(*) from sniper_alerts  where lower(author_handle) = lower('HANDLE')) as alerts,
  (select count(*) from watch_targets  where lower(handle) = lower('HANDLE') and active) as still_watched;
```

All three must be 0. Then confirm completion to the requester in writing.

**Step 4 — keep the handle off future lists.** Record the handle below so it is never re-seeded:

| Date | Handle | Request type | Completed |
|---|---|---|---|
| _none yet_ | | | |

## 4. Log the request

Add a dated row to the table above for every DSR handled (date received, handle, type,
completion date). This table is the Art. 5(2) accountability record for DSRs.
