-- Deck management / flashcard editor (2026-06-02): notes need a persisted,
-- editable order. id ordering is meaningless (random UUIDs), so add an explicit
-- per-deck position. Column named `note_position` to dodge the `POSITION`
-- keyword on some engines (Flyway also runs against H2 in tests).
--
-- V1 is intentionally idempotent; V2+ use strict syntax.

alter table notes add column note_position int;

-- Backfill a deterministic 0-based order per deck. Correlated count (no window
-- function / UPDATE..FROM) so it runs identically on Postgres and H2.
update notes n
set note_position = (
  select count(*) from notes n2
  where n2.deck_id = n.deck_id and n2.id < n.id
);

create index notes_deck_position_idx on notes(deck_id, note_position);
