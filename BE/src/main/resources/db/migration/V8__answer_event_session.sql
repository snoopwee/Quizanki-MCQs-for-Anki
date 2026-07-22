-- Per-test history: tag each answer event with its quiz session so the chart can
-- show one point PER TEST instead of collapsing a day's tests into a single
-- daily average. The FE already generates a session id per quiz (startSession)
-- and sends it on every /sessions/{sessionId}/answers call — it was just dropped
-- by the controller and never persisted. Now record_answer stores it.
--
-- Legacy rows (recorded before this migration) have session_id NULL; the history
-- query falls back to day-bucketing those so early test data still charts.
--
-- V1 is intentionally idempotent; V2+ use strict syntax.

alter table answer_events add column session_id uuid;
create index answer_events_session_idx on answer_events(session_id);

-- record_answer gains a session id. Its signature changes, so drop the 2-arg
-- version and recreate: body is V7's (= V3 mastery curve verbatim + the event
-- insert) with session_id added to the inserted event. Do NOT drift the mastery
-- constants — this function is their single source of truth.
drop function if exists record_answer(uuid, boolean);

create or replace function record_answer(p_note_id uuid, p_correct boolean, p_session_id uuid)
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

  insert into answer_events(note_id, correct, session_id)
  values (p_note_id, p_correct, p_session_id);
end;
$$;
