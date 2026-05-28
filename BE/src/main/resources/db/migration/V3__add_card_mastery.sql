-- Per-card mastery (0-100). Distinct from the historical `accuracy`: mastery is
-- a learning-progress signal the FE uses to weight question selection so that
-- low-mastery cards reappear more often and mastered cards space out (Anki-like).
--
-- Initial curve (deliberately tunable in a future migration):
--   start         = 0
--   on correct    = clamp(mastery + 15, 0, 100)
--   on incorrect  = clamp(mastery - 20, 0, 100)  -- lapses hurt slightly more
--
-- Why these numbers: ~7 consecutive correct answers take a fresh card from 0 to
-- mastered (gradual, not after 2-3 lucky guesses), and a single wrong answer
-- knocks 20 points off without erasing all progress. Asymmetric on purpose.
--
-- These constants live ONLY in this SQL function so there is one source of truth.
-- Adjusting them later means a new V*.sql that replaces this function — do not
-- duplicate the math in Java.

alter table card_stats add column mastery float not null default 0;

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
end;
$$;
