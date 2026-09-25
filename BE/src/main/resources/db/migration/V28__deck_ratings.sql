-- Deck ratings (2026-09-22) — a public score, and a note only the deck's author can read.
--
-- The rating is the public signal; `note` is private feedback that leaves this table ONLY through
-- the author-only endpoint. Nothing else — no deck DTO, no Discover row, no shared-deck page — may
-- select it. The author can clear a note, but never a rating: if they could, the public number
-- would only ever reflect the ratings they liked.
--
-- Both changes are additive (a new table, plus two defaulted columns), so the production backend
-- still on the previous release keeps working.
--
-- V1 is intentionally idempotent; V2+ use strict syntax.

create table deck_ratings (
  deck_id    uuid        not null references decks(id) on delete cascade,
  user_id    text        not null,
  stars      smallint    not null,
  -- Optional, private to the deck's author.
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One rating per person per deck. Deck first, so "every rating for this deck" — the author's
  -- feedback page and the aggregate refresh — rides the primary key without a second index.
  primary key (deck_id, user_id),
  constraint deck_ratings_stars_range check (stars between 1 and 5)
);

-- The aggregate is denormalised onto decks because Discover has to sort and filter by it, and a
-- GROUP BY per card does not scale. `card_count` is already kept this way, so this follows suit.
-- Storing the SUM rather than an average keeps it exact integer arithmetic, and the service
-- recomputes both from the table after every write rather than doing incremental maths — a tiny
-- per-deck scan that cannot drift.
alter table decks add column rating_count integer not null default 0;
alter table decks add column rating_sum   integer not null default 0;

-- RLS on with no policies: Spring connects as postgres (BYPASSRLS), while the PostgREST API that
-- Supabase exposes gets deny-all (the V20 lesson). It matters more here than usual — this table
-- holds text its writer expects only one person to read.
alter table deck_ratings enable row level security;
