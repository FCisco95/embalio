-- Add needs_manual_confirmation to posting_jobs status set.
-- This is a non-retryable intermediate state for posts where AdsPower ran but we
-- couldn't capture a confirmed tweet URL.  The partial unique index now also
-- covers this status so auto-retry cannot fire a second live post while the first
-- is in an unconfirmed state.

alter table posting_jobs
  drop constraint posting_jobs_status_check;

alter table posting_jobs
  add constraint posting_jobs_status_check
  check (status in ('queued','running','succeeded','failed','needs_manual_confirmation'));

-- Extend the idempotency index so needs_manual_confirmation also blocks re-entry.
drop index posting_jobs_active_draft_uidx;

create unique index posting_jobs_active_draft_uidx
  on posting_jobs (draft_id)
  where status in ('running','succeeded','needs_manual_confirmation');

-- Add unconfirmed draft status for parity (draft whose post ran but URL unverified).
alter table drafts
  drop constraint drafts_status_check;

alter table drafts
  add constraint drafts_status_check
  check (status in ('draft','approved','posted','skipped','unconfirmed'));
