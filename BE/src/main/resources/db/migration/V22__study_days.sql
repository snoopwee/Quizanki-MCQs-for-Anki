-- Study days (2026-09-14, Phase 7 S2) — the source of truth for the daily study streak.
--
-- One row per user per LOCAL calendar day on which they studied. The backend computes
-- local_date from the client's IANA timezone at write time, so a "day" is the user's own
-- day rather than UTC's: without it, a learner in UTC+7 studying at 06:00 local time would
-- be filed under the previous day. The streak is computed straight from these dates.
--
-- What marks a day: every recorded answer (quiz or Learn, via SessionService) plus
-- POST /me/activity for study that produces no graded answer. first_source only keeps what
-- started the day. 'flashcards' is valid HERE but not in answer_events: studying deck-page
-- flashcards can keep a streak going without ever touching mastery.
--
-- No backfill. answer_events carries no timezone, so UTC dates would misfile study for
-- users east of UTC; the streak starts from the first study after this ships (the same
-- no-backfill choice V7 made for answer history).
--
-- Additive only (a new table), so it is safe for a production backend still on the
-- previous release — local development and production share this database.
--
-- RLS enabled with no policies: Spring connects as postgres (BYPASSRLS), while the PostgREST
-- API that Supabase exposes gets deny-all (the V20 lesson).
--
-- V1 is intentionally idempotent; V2+ use strict syntax.

create table study_days (
    user_id      text        not null,
    local_date   date        not null,
    first_source text        not null,
    created_at   timestamptz not null default now(),
    primary key (user_id, local_date),
    constraint study_days_first_source_check
        check (first_source in ('quiz', 'learn', 'flashcards'))
);

alter table study_days enable row level security;
