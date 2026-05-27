alter table profiles
  add column voice_spec text,
  add column goals text,
  add column content_pillars text[] not null default '{}',
  add column onboarding_answers jsonb not null default '{}';
