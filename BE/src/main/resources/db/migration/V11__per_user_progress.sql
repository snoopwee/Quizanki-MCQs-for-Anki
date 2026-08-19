-- Per-user progress (2026-07-24). Progress was stored per NOTE — card_stats had
-- note_id as its sole primary key, so there was exactly one progress row per card,
-- globally, owned transitively by the note's deck owner. That only works while a
-- card is studied by one person. The product is now about studying each other's
-- shared decks (Discover), where progress must be private to each user: "how well
-- does SOMEONE know THIS card" is a fact about the (user, card) pair, not the card.
--
-- So card_stats and answer_events gain user_id, and card_stats is re-keyed on
-- (user_id, note_id). Deck completion for a user stays "average of their mastery
-- over the notes currently in the deck (missing row = 0)" — unchanged in shape,
-- just scoped to that user. The note_id -> notes ON DELETE CASCADE is kept, which
-- gives the intended lifecycle: delete the deck and everyone's progress on it goes
-- (there's nowhere for it to live); unsharing deletes nothing.
--
-- Backfill: every existing progress/history row belongs to its note's deck owner.
--
-- V1 is intentionally idempotent; V2+ use strict syntax.

-- ── card_stats: progress becomes per-user ───────────────────────────────────
alter table card_stats add column user_id text;

-- Correlated subquery (portable) rather than UPDATE ... FROM: assign each existing
-- row to the owner of the deck its note belongs to.
update card_stats
set user_id = (
    select d.user_id
    from notes n
    join decks d on d.id = n.deck_id
    where n.id = card_stats.note_id
);

-- Any row whose note/deck no longer resolves (shouldn't happen under the FK) would
-- block the NOT NULL — drop those rather than fail the migration.
delete from card_stats where user_id is null;

alter table card_stats alter column user_id set not null;

-- Swap the primary key note_id -> (user_id, note_id). The note_id FK to notes
-- (ON DELETE CASCADE) is a separate constraint and is intentionally kept.
alter table card_stats drop constraint card_stats_pkey;
alter table card_stats add primary key (user_id, note_id);

-- ── answer_events: history becomes per-user ─────────────────────────────────
alter table answer_events add column user_id text;

update answer_events
set user_id = (
    select d.user_id
    from notes n
    join decks d on d.id = n.deck_id
    where n.id = answer_events.note_id
);

delete from answer_events where user_id is null;

alter table answer_events alter column user_id set not null;

-- The history chart scans a user's events over a time window.
create index answer_events_user_idx on answer_events(user_id, answered_at);

-- ── record_answer: now takes the acting user ────────────────────────────────
-- Body is V8's verbatim (the ±15/−20 mastery curve is the single source of truth —
-- do NOT drift it) with user_id threaded through the upsert key and both inserts.
-- The old 3-arg signature is dropped so nothing calls it by accident.
drop function if exists record_answer(uuid, boolean, uuid);

create or replace function record_answer(
    p_user_id text, p_note_id uuid, p_correct boolean, p_session_id uuid)
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

  insert into answer_events(user_id, note_id, correct, session_id)
  values (p_user_id, p_note_id, p_correct, p_session_id);
end;
$$;
