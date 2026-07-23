-- Deck authorship + the Discover directory (2026-07-23). V9 made decks shareable
-- but anonymous — a shared deck read "Shared deck" with no one's name on it, and
-- there was no way to browse what other people had published.
--
--   * decks.author_id          — WHO IS CREDITED, which is not the same as who
--     owns the row. On a fresh import they're identical, but a copy is owned by
--     the person who took it while still crediting the original author, so the
--     two must be separate columns. Credit moves to the copier the first time
--     they save a real card change (a rename alone doesn't count).
--   * decks.author_name        — the credited author's display name, denormalised.
--     Identity lives only in Supabase auth.users; there is no user table to join,
--     so the name is snapshotted from the caller's JWT and re-stamped whenever the
--     author writes the deck.
--   * decks.source_author_name — who this was copied FROM, for the "Original deck
--     by X" credit line. Also denormalised (not resolved through
--     clone_source_deck_id) so the credit survives the original being deleted —
--     V9 deliberately gave that column no foreign key.
--
-- Backfill: every existing deck is authored by its owner. author_name is left
-- NULL and gets filled in on that deck's next write; the UI falls back gracefully.
--
-- V1 is intentionally idempotent; V2+ use strict syntax.

alter table decks add column author_id text;
alter table decks add column author_name text;
alter table decks add column source_author_name text;

update decks set author_id = user_id where author_id is null;

alter table decks alter column author_id set not null;

-- Discover lists public decks newest-shared first; the partial index keeps that
-- scan proportional to the shared decks rather than the whole table.
create index decks_public_idx on decks (shared_at desc) where is_public;
