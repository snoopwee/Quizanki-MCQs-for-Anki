-- Initial schema for AnkiQuiz.
-- Idempotent so it's safe to (re-)apply against the existing manually-created
-- Supabase schema on first Flyway run. Subsequent migrations (V2+) should use
-- strict CREATE TABLE / CREATE INDEX without IF NOT EXISTS.

create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────
-- decks — one row per imported Anki deck
-- ─────────────────────────────────────────────
create table if not exists decks (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               text not null,
  name                  text not null,
  subdeck_path          text,
  question_field        text not null,
  answer_field          text not null,
  detection_confidence  float default 0,
  card_count            int default 0,
  imported_at           timestamptz default now()
);

create index if not exists decks_user_idx on decks(user_id);

-- ─────────────────────────────────────────────
-- notes — one row per Anki note (not card)
-- ─────────────────────────────────────────────
create table if not exists notes (
  id              uuid primary key default uuid_generate_v4(),
  deck_id         uuid references decks(id) on delete cascade,
  anki_note_id    text,
  fields          jsonb not null,
  tags            text[] default '{}'
);

create unique index if not exists notes_anki_id_idx on notes(deck_id, anki_note_id);
create index if not exists notes_deck_idx on notes(deck_id);
create index if not exists notes_tags_idx on notes using gin(tags);

-- ─────────────────────────────────────────────
-- card_stats — MCQ performance per note
-- ─────────────────────────────────────────────
create table if not exists card_stats (
  note_id         uuid primary key references notes(id) on delete cascade,
  times_seen      int default 0,
  times_correct   int default 0,
  accuracy        float default 0,
  streak          int default 0,
  last_seen_at    timestamptz
);

-- ─────────────────────────────────────────────
-- record_answer — atomic upsert called after each MCQ answer
-- ─────────────────────────────────────────────
create or replace function record_answer(p_note_id uuid, p_correct boolean)
returns void language plpgsql as $$
begin
  insert into card_stats(note_id, times_seen, times_correct, accuracy, streak, last_seen_at)
  values (
    p_note_id,
    1,
    case when p_correct then 1 else 0 end,
    case when p_correct then 1.0 else 0.0 end,
    case when p_correct then 1 else 0 end,
    now()
  )
  on conflict (note_id) do update set
    times_seen    = card_stats.times_seen + 1,
    times_correct = card_stats.times_correct + case when p_correct then 1 else 0 end,
    accuracy      = (card_stats.times_correct + case when p_correct then 1 else 0 end)::float
                    / (card_stats.times_seen + 1),
    streak        = case when p_correct then card_stats.streak + 1 else 0 end,
    last_seen_at  = now();
end;
$$;

-- ─────────────────────────────────────────────
-- Row Level Security — defense in depth.
-- Spring Boot connects as `postgres` (BYPASSRLS) so its queries are unaffected.
-- Any other connection (anon, authenticated) gets zero rows because no policies exist.
-- ─────────────────────────────────────────────
alter table decks       enable row level security;
alter table notes       enable row level security;
alter table card_stats  enable row level security;
