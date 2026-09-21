-- FSRS scheduling state (2026-09-16, Phase 8 S8).
--
-- card_stats already holds per-user progress (V11) and mastery (V3). Mastery answers "how well
-- does this learner know the card" and stays the number the UI shows; the columns added here
-- answer "when should it come back" and are only ever written by the FSRS scheduler
-- (service/fsrs/Fsrs.java). record_answer is deliberately NOT touched by this migration — the
-- mastery curve stays exactly where it is.
--
-- Additive only (new nullable / defaulted columns, one index, one new table), so a production
-- backend still running the previous release keeps working while this is applied: local
-- development and production share ONE database and Flyway runs from whichever backend starts
-- first (the V21 lesson).
--
-- No backfill. A card with stability IS NULL has never been scheduled and enters the scheduler as
-- new on its first review, so nothing is retro-scheduled off last_seen_at — the same stance V7 and
-- V22 took for history and streaks.
--
-- V1 is intentionally idempotent; V2+ use strict syntax.

-- ── card_stats: per-card schedule ───────────────────────────────────────────
-- stability      FSRS memory stability, in days (interval at 90% requested retention)
-- difficulty     FSRS difficulty, 1-10
-- due_at         when the card should next be reviewed; NULL = never scheduled
-- last_review_at when the scheduler last saw it (drives elapsed days, distinct from
--                last_seen_at, which every quiz / Learn answer touches)
alter table card_stats add column due_at         timestamptz;
alter table card_stats add column stability      double precision;
alter table card_stats add column difficulty     double precision;
alter table card_stats add column reps           int not null default 0;
alter table card_stats add column lapses         int not null default 0;
alter table card_stats add column last_review_at timestamptz;

-- The due queue reads "my cards, due by now", per user, ordered by due_at.
create index card_stats_due_idx on card_stats (user_id, due_at);

-- ── review_events: append-only log of every rating ──────────────────────────
-- Kept separate from answer_events: that log stores a graded right/wrong for the accuracy chart,
-- while a review records a 1-4 rating and what the scheduler did with it. Logging the inputs and
-- outputs is what makes optimizing the FSRS weights per user possible later.
create table review_events (
  id              bigserial   primary key,
  user_id         text        not null,
  note_id         uuid        not null references notes(id) on delete cascade,
  rating          smallint    not null,
  -- Which surface produced the rating: the Review screen, or a quiz / Learn answer mapped
  -- onto a rating (wrong -> again, right -> good).
  source          text        not null,
  -- What the scheduler saw and decided, for later weight optimization.
  elapsed_days    double precision,
  scheduled_days  double precision,
  stability_after double precision,
  difficulty_after double precision,
  reviewed_at     timestamptz not null default now(),
  constraint review_events_rating_check check (rating between 1 and 4),
  constraint review_events_source_check check (source in ('review', 'quiz', 'learn'))
);

create index review_events_user_time_idx on review_events (user_id, reviewed_at);
create index review_events_note_idx on review_events (note_id);

-- RLS on with no policies: Spring connects as postgres (BYPASSRLS), while the PostgREST API
-- Supabase exposes gets deny-all (the V20 lesson).
alter table review_events enable row level security;
