-- One-tap "Done" logs a reply without its URL (captured later for the metrics loop).
-- Dropping NOT NULL is non-breaking: existing rows + existing inserts that supply a
-- URL are unaffected; only the new markRepliedQuick path inserts a null.
alter table public.posts alter column tweet_url drop not null;
