-- Deck sharing (2026-07-23). An owner can flip a deck to "shared", which makes it
-- readable by anyone holding its link; recipients then CLONE it into their own
-- account rather than studying it in place.
--
-- Why clone and not a live shared deck: progress lives in card_stats keyed by
-- note_id, and notes belong to the owner's deck. Two people studying one deck
-- would collide on the same rows. A clone gives the recipient their own notes,
-- and therefore their own mastery, while the owner's deck and stats stay
-- untouched.
--
--   * decks.is_public            — the share switch. Off by default; a deck is
--     only ever readable by others while this is true.
--   * decks.shared_at            — when it was last switched on (NULL = never).
--   * decks.clone_source_deck_id — provenance for moderation/analytics. Nullable
--     and deliberately WITHOUT a foreign key, so deleting the original does not
--     cascade into everyone's copies.
--
-- The share link uses the deck's existing v4 UUID (already unguessable), gated on
-- is_public — there is no separate slug to keep in sync.
--
-- V1 is intentionally idempotent; V2+ use strict syntax.

alter table decks add column is_public boolean not null default false;
alter table decks add column shared_at timestamptz;
alter table decks add column clone_source_deck_id uuid;
