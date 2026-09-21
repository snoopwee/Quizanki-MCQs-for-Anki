-- Folders (2026-09-21, Phase 10 S1) — grouping for people with many decks.
--
-- A deck can sit in SEVERAL folders (what Quizlet and Knowt both do), so this is a join table
-- rather than a column on decks. That also keeps folders entirely the viewer's own business: a
-- folder can hold a deck they merely saved, and filing someone else's public deck changes nothing
-- for its owner.
--
-- Both tables are new, so this is safe for a production backend still on the previous release.
--
-- V1 is intentionally idempotent; V2+ use strict syntax.

create table folders (
  id         uuid        primary key default gen_random_uuid(),
  user_id    text        not null,
  name       text        not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint folders_name_not_blank check (length(btrim(name)) > 0),
  -- Two folders with the same name in one account are a usability trap, not a feature.
  constraint folders_user_name_unique unique (user_id, name)
);

create index folders_user_idx on folders (user_id, name);

create table folder_decks (
  folder_id uuid        not null references folders(id) on delete cascade,
  deck_id   uuid        not null references decks(id) on delete cascade,
  added_at  timestamptz not null default now(),
  primary key (folder_id, deck_id)
);

-- Deleting a deck should take its filings with it (the FK cascade above does that); this index
-- makes that cascade — and "which folders is this deck in?" — cheap.
create index folder_decks_deck_idx on folder_decks (deck_id);

-- RLS on with no policies: Spring connects as postgres (BYPASSRLS), while the PostgREST API that
-- Supabase exposes gets deny-all (the V20 lesson).
alter table folders enable row level security;
alter table folder_decks enable row level security;
