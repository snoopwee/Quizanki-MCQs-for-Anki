-- Answer source (2026-09-14, Phase 7 S1). Every answer used to come from the quiz, so
-- answer_events never recorded where it came from. Study mode (Learn, Phase 7 S6) is a
-- second place that records mastery, so each event now records its source: 'quiz' or
-- 'learn'. The daily streak (S2) and Learn build on it.
--
-- Deck-page flashcards — including Know / Still learning card sorting — are preview and
-- reading material and deliberately do NOT record mastery, so there is no 'flashcards'
-- source. Mastery only moves during a quiz or study mode (user decision, 2026-09-14).
--
-- WARNING: record_answer keeps its OLD 4-arg signature, rewritten as a thin wrapper,
-- instead of being dropped. Local development and production share ONE Supabase
-- database, and Flyway applies migrations from whichever backend starts first. If a
-- local backend applies this while production still runs the previous release (which
-- calls the 4-arg form), dropping that signature would make every production answer
-- fail with "function does not exist". The wrapper keeps that caller working and tags
-- its answers 'quiz', which is what they are. Drop it in a later migration once
-- production calls the 5-arg form.
--
-- V1 is intentionally idempotent; V2+ use strict syntax.

-- ── answer_events.source ─────────────────────────────────────────────────────
-- Every existing row is a quiz answer, so the default backfills them correctly.
alter table answer_events add column source text not null default 'quiz';

alter table answer_events add constraint answer_events_source_check
    check (source in ('quiz', 'learn'));

-- ── record_answer: gains p_source ───────────────────────────────────────────
-- Body is V11's verbatim (the ±15/−20 mastery curve is the single source of truth —
-- do NOT drift it); the only change is source on the answer_events insert.
-- p_source deliberately has NO default: a default would make a 4-arg call ambiguous
-- between this function and the wrapper below.
create function record_answer(
    p_user_id text, p_note_id uuid, p_correct boolean, p_session_id uuid, p_source text)
returns void language plpgsql as $$
declare
  v_delta float := case when p_correct then 15.0 else -20.0 end;
begin
  insert into card_stats(user_id, note_id, times_seen, times_correct, accuracy, streak, mastery, last_seen_at)
  values (
    p_user_id,
    p_note_id,
    1,
    case when p_correct then 1 else 0 end,
    case when p_correct then 1.0 else 0.0 end,
    case when p_correct then 1 else 0 end,
    greatest(0.0, least(100.0, v_delta)),
    now()
  )
  on conflict (user_id, note_id) do update set
    times_seen    = card_stats.times_seen + 1,
    times_correct = card_stats.times_correct + case when p_correct then 1 else 0 end,
    accuracy      = (card_stats.times_correct + case when p_correct then 1 else 0 end)::float
                    / (card_stats.times_seen + 1),
    streak        = case when p_correct then card_stats.streak + 1 else 0 end,
    mastery       = greatest(0.0, least(100.0, card_stats.mastery + v_delta)),
    last_seen_at  = now();

  insert into answer_events(user_id, note_id, correct, session_id, source)
  values (p_user_id, p_note_id, p_correct, p_session_id, p_source);
end;
$$;

-- The previous 4-arg signature, now a thin wrapper that records a quiz answer.
-- Kept for a production backend still on the previous release — see the warning above.
create or replace function record_answer(
    p_user_id text, p_note_id uuid, p_correct boolean, p_session_id uuid)
returns void language plpgsql as $$
begin
  perform record_answer(p_user_id, p_note_id, p_correct, p_session_id, 'quiz');
end;
$$;
