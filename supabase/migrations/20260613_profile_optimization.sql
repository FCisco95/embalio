alter table profiles
  add column if not exists bio_optimized boolean not null default false,
  add column if not exists pinned_optimized boolean not null default false;
