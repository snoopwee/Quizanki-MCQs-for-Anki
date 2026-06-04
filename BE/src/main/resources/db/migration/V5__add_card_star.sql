-- Per-card "star": a user-set focus flag, distinct from the answer-derived
-- mastery/accuracy signals. Lets a learner mark cards to concentrate on and
-- later run a quiz scoped to just those cards (?starredOnly=true).
--
-- Lives on card_stats because that is already the per-note user-state table
-- (one row per note, decks are user-owned). A card the user has never answered
-- has no card_stats row yet, so starring such a card inserts a default row with
-- only `starred` set — see NoteService.setStarred.
--
-- V1 is intentionally idempotent; V2+ use strict syntax.

alter table card_stats add column starred boolean not null default false;
