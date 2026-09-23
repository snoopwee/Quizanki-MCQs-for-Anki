-- Profiles (2026-09-23, Phase 11) — the app's first user table, and only just.
--
-- Identity lives in Supabase auth, and until now the ONLY app-side copy of a person's name and
-- avatar was denormalised onto their deck rows. That has two consequences this phase ran into:
--
--   * somebody who has published nothing has no name anywhere in our database, so their public
--     page (`/authors/{id}`, which IS the profile page) has nothing to render; and
--   * a follower list can't be drawn at all, because followers are mostly learners, not authors.
--
-- So: one row per person, written from their JWT on every GET /me — no Admin API call, because the
-- access token already carries display_name / full_name / avatar_url (see Caller).
--
-- This does NOT replace decks.author_name / author_avatar_url. Those stay as a CREDIT SNAPSHOT:
-- a copy of someone else's deck keeps crediting the original author, which is a different fact
-- from "what is this person called today".
--
-- The backfill seeds what we already know from those snapshots, newest deck per author winning.

create table profiles (
  user_id      text        primary key,
  display_name text,
  avatar_url   text,
  updated_at   timestamptz not null default now()
);

-- Seed from the denormalised copies already on decks. distinct on + order by picks each author's
-- most recent deck, which carries their most recently synced name.
insert into profiles (user_id, display_name, avatar_url, updated_at)
select distinct on (author_id)
       author_id,
       author_name,
       author_avatar_url,
       now()
from decks
where author_id is not null and author_id <> ''
order by author_id, imported_at desc nulls last
on conflict (user_id) do nothing;

-- RLS on with no policies: Spring connects as postgres (BYPASSRLS), while the PostgREST API that
-- Supabase exposes gets deny-all (the V20 lesson).
alter table profiles enable row level security;
