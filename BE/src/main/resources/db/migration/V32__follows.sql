-- Following an author (2026-09-23, Phase 11 S1).
--
-- Author pages already exist and are built from public decks; this is the subscription to one.
-- When a followed author publishes, every follower gets a notification — the first fan-out in this
-- app that reaches MANY people from a single request, which is why the notification write side
-- grew a batched path alongside this.
--
-- No foreign keys: identity lives in Supabase auth, not in a local table, so every user id in this
-- schema is plain text (decks.user_id, notifications.user_id, deck_ratings.user_id all are).
--
-- The table is new, so this is safe for a production backend still on the previous release.

create table follows (
  follower_id text        not null,
  author_id   text        not null,
  created_at  timestamptz not null default now(),
  -- Follower first: "who do I follow" and "am I following X" both ride the primary key.
  primary key (follower_id, author_id),
  -- Following yourself would put your own decks in your own feed and inflate your follower count.
  constraint follows_not_self check (follower_id <> author_id)
);

-- The other direction — "who follows this author" — is the fan-out query when a deck is published,
-- and the follower count on an author page. It needs its own index.
create index follows_author_idx on follows (author_id);

-- RLS on with no policies: Spring connects as postgres (BYPASSRLS), while the PostgREST API that
-- Supabase exposes gets deny-all (the V20 lesson).
alter table follows enable row level security;
