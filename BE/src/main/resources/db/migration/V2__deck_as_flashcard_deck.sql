-- Direction change (2026-05-26): a deck is the whole flashcard deck.
-- The question/answer field choice moves to test time, so the deck-level
-- question_field/answer_field are no longer required. We add per-deck note types
-- so a saved deck can rebuild its flashcard layout (front/back fields), and link
-- each note to its note type.
--
-- V1 is intentionally idempotent; V2+ use strict syntax (no IF NOT EXISTS).

-- Field choice is per-test now, not a deck property.
alter table decks alter column question_field drop not null;
alter table decks alter column answer_field drop not null;

-- The original .apkg filename, shown as the deck's default name/source.
alter table decks add column source_filename text;

-- One row per Anki note type (model) within a deck. Stores the field list and the
-- author's front/back card layout so the deck can be studied as flashcards and any
-- field can be chosen as the quiz prompt/answer at test time.
create table note_types (
  id             uuid primary key default uuid_generate_v4(),
  deck_id        uuid not null references decks(id) on delete cascade,
  anki_model_id  bigint,
  name           text not null,
  cloze          boolean not null default false,
  field_names    text[] not null default '{}',
  front_fields   text[] not null default '{}',
  back_fields    text[] not null default '{}'
);

create index note_types_deck_idx on note_types(deck_id);

-- Link notes to their note type (nullable for any pre-existing rows).
alter table notes add column note_type_id uuid references note_types(id) on delete cascade;
create index notes_note_type_idx on notes(note_type_id);

-- RLS parity with the other tables (Spring Boot connects as a BYPASSRLS role).
alter table note_types enable row level security;
