-- Review as a study source + the study settings (2026-09-16, Phase 8 S9).
--
-- The Review screen is graded study like the quiz and Learn: rating a card records an answer
-- (Again = wrong, Hard / Good / Easy = right), so it moves mastery and marks the streak day, on
-- top of the FSRS scheduling V23 added. Both of those writes are constrained to a source list, so
-- both lists have to learn 'review' before the first review lands.
--
-- Widening a CHECK is safe for the production backend still on the previous release: every value
-- it writes ('quiz', 'learn', 'flashcards') still passes. Local development and production share
-- ONE database and Flyway runs from whichever backend starts first (the V21 lesson).
--
-- V1 is intentionally idempotent; V2+ use strict syntax.

-- ── answer_events.source gains 'review' ─────────────────────────────────────
alter table answer_events drop constraint answer_events_source_check;
alter table answer_events add constraint answer_events_source_check
    check (source in ('quiz', 'learn', 'review'));

-- ── study_days.first_source gains 'review' ──────────────────────────────────
-- 'flashcards' stays allowed even though nothing writes it any more (deck-page flashcards stopped
-- marking the streak on 2026-09-15): rows already written with it must keep passing the check.
alter table study_days drop constraint study_days_first_source_check;
alter table study_days add constraint study_days_first_source_check
    check (first_source in ('quiz', 'learn', 'flashcards', 'review'));

-- ── user_settings — the daily review limits ─────────────────────────────────
-- Global per account, not per deck (user decision, 2026-09-16). A missing row means the defaults,
-- so nothing needs backfilling and a user only gets a row once they change something.
--
-- The defaults match Anki's out-of-the-box pacing closely enough to be unsurprising: 20 new cards
-- and 200 reviews a day.
create table user_settings (
  user_id             text        primary key,
  new_per_day         int         not null default 20,
  max_reviews_per_day int         not null default 200,
  updated_at          timestamptz not null default now(),
  constraint user_settings_new_per_day_check check (new_per_day between 0 and 9999),
  constraint user_settings_max_reviews_check check (max_reviews_per_day between 0 and 9999)
);

-- RLS on with no policies: Spring connects as postgres (BYPASSRLS), while the PostgREST API
-- Supabase exposes gets deny-all (the V20 lesson).
alter table user_settings enable row level security;
