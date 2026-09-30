-- Covering indexes for three foreign keys that had none (2026-09-29).
--
-- Flagged by Supabase's performance advisor (unindexed_foreign_keys) and confirmed against the
-- live schema: each of these FKs is ON DELETE CASCADE, and none has an index Postgres can use to
-- find the child rows.
--
--   card_stats.note_id      -> notes(id)   ON DELETE CASCADE
--   user_deck.deck_id       -> decks(id)   ON DELETE CASCADE
--   review_reports.deck_id  -> decks(id)   ON DELETE CASCADE
--
-- WHY THE PRIMARY KEYS DON'T ALREADY COVER THEM. Two of these tables do have the column in their
-- PK — but as the SECOND column of a composite:
--
--   card_stats_pkey  (user_id, note_id)
--   user_deck_pkey   (user_id, deck_id)
--
-- A btree on (a, b) can serve a lookup on `a`, or on `a AND b`, but not on `b` alone. Deleting a
-- note or a deck searches by exactly that second column, so both fall back to a sequential scan.
--
-- WHAT IT COSTS IN PRACTICE. Every parent delete scans the whole child table. Deleting one deck
-- cascades to its notes, and EACH note delete then scans card_stats — so the cost of removing a
-- deck grows with (notes in the deck) x (rows in card_stats). card_stats holds one row per
-- (user, note), which makes it the fastest-growing table in the schema after notes: a deck studied
-- by N people is N rows per card. It is small today (93 rows), which is exactly why this is cheap
-- to fix now and unpleasant to fix later.
--
-- PLAIN CREATE INDEX, NOT CONCURRENTLY. Flyway runs each migration inside a transaction and
-- CREATE INDEX CONCURRENTLY cannot run in one. These three tables are tiny (93 / 21 / 1 rows), so
-- the exclusive lock is momentary. ⚠ If one of these ever grows large, adding a further index will
-- need CONCURRENTLY outside Flyway instead — do not copy this pattern onto a big table.
--
-- Safe for a DEPLOYED backend running older code: adding an index changes no behaviour and no
-- entity mapping, so an instance on the previous release keeps working (the shared-DB rule).

create index card_stats_note_idx on card_stats (note_id);

create index user_deck_deck_idx on user_deck (deck_id);

create index review_reports_deck_idx on review_reports (deck_id);
