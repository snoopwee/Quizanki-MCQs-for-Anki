-- A user's relationship to a deck: their library (2026-07-24). With progress now
-- per-user (V11), a signed-in user studies any deck without copying it — so we
-- need to remember which decks are theirs to return to. One row per (user, deck):
--
--   * saved          — the user bookmarked it to their Home ("Save to Home").
--     A bookmark is a REFERENCE, not a copy. A saved deck stays openable and
--     duplicable even if its owner later makes it private (unshares) — "private"
--     only removes it from Discovery for new people, it doesn't revoke savers.
--   * last_opened_at  — when they last opened the deck page. Drives the "Recent"
--     tab (decks opened in the last ~30 days); NULL = saved but not yet opened.
--
-- Deleting a deck removes these rows too (FK cascade) — a saved reference can't
-- outlive the deck it points at, matching how progress behaves.
--
-- V1 is intentionally idempotent; V2+ use strict syntax.

create table user_deck (
  user_id        text not null,
  deck_id        uuid not null references decks(id) on delete cascade,
  saved          boolean not null default false,
  last_opened_at timestamptz,
  primary key (user_id, deck_id)
);

-- The Recent tab scans a user's rows newest-opened first.
create index user_deck_recent_idx on user_deck (user_id, last_opened_at desc);

-- Defense in depth: Spring connects as postgres (BYPASSRLS); any other role sees
-- zero rows (no policies), mirroring decks/notes/card_stats.
alter table user_deck enable row level security;
