-- Answer history for accuracy-over-time charts.
--
-- Sessions have always been ephemeral (startSession just hands back a throwaway
-- UUID; nothing was ever persisted), and card_stats only keeps the LATEST touch
-- per card (last_seen_at is overwritten each answer). So there was no time-series
-- to chart. This adds an append-only event log: one row per graded MCQ answer.
--
-- Design:
--   * append-only, never updated — cheap insert on the hot answer path
--   * FK to notes with ON DELETE CASCADE, so deleting a deck/note takes its
--     history with it (same lifecycle as card_stats)
--   * deck scoping is done by JOIN notes at read time (StatsService), matching
--     how getDeckStats already aggregates — no denormalised deck_id/user_id here
--   * no JPA entity: queried via native SQL like getDeckStats, so ddl-auto:
--     validate never sees it (it only checks mapped entities)
--
-- Guests answer entirely client-side and never hit record_answer, so the chart
-- reflects signed-in study only — expected. There is no backfill: the series
-- starts empty and fills from the first answer after this migration ships.
--
-- V1 is intentionally idempotent; V2+ use strict syntax.

create table answer_events (
  id           bigserial primary key,
  note_id      uuid not null references notes(id) on delete cascade,
  correct      boolean not null,
  answered_at  timestamptz not null default now()
);

-- note_id for cascade/lookup; answered_at for the time-range scan the chart runs.
create index answer_events_note_idx on answer_events(note_id);
create index answer_events_answered_idx on answer_events(answered_at);

-- Re-define record_answer to ALSO append a history event, keeping the entire
-- write in one atomic call. Body is V3's mastery-aware version verbatim (do not
-- drift the mastery curve — those constants are the single source of truth) plus
-- the trailing insert into answer_events.
create or replace function record_answer(p_note_id uuid, p_correct boolean)
returns void language plpgsql as $$
declare
  v_delta float := case when p_correct then 15.0 else -20.0 end;
begin
  insert into card_stats(note_id, times_seen, times_correct, accuracy, streak, mastery, last_seen_at)
  values (
    p_note_id,
    1,
    case when p_correct then 1 else 0 end,
    case when p_correct then 1.0 else 0.0 end,
    case when p_correct then 1 else 0 end,
    greatest(0.0, least(100.0, v_delta)),
    now()
  )
  on conflict (note_id) do update set
    times_seen    = card_stats.times_seen + 1,
    times_correct = card_stats.times_correct + case when p_correct then 1 else 0 end,
    accuracy      = (card_stats.times_correct + case when p_correct then 1 else 0 end)::float
                    / (card_stats.times_seen + 1),
    streak        = case when p_correct then card_stats.streak + 1 else 0 end,
    mastery       = greatest(0.0, least(100.0, card_stats.mastery + v_delta)),
    last_seen_at  = now();

  insert into answer_events(note_id, correct) values (p_note_id, p_correct);
end;
$$;

-- Defense in depth: Spring connects as postgres (BYPASSRLS); any other role sees
-- zero rows because no policies exist. Mirrors decks/notes/card_stats in V1.
alter table answer_events enable row level security;
