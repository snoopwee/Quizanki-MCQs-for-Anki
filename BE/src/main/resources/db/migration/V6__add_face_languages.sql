-- Per-face text-to-speech language (2026-07-15). A card's term (front) and
-- definition (back) can be in different languages, and script-based auto-detection
-- is ambiguous for CJK — bare kanji (Han, no kana) reads as Chinese instead of
-- Japanese. So each face carries an optional primary language for TTS:
--
--   * decks.front_lang / decks.back_lang  — deck-level default, set at import from
--     the majority language of that face across all cards; editable in the
--     Flashcards Options modal.
--   * notes.front_lang / notes.back_lang  — per-card override, set in the editor.
--
-- Resolution at speak time: note override, else deck default, else auto-detect.
-- All nullable: NULL means "inherit / auto-detect". Stored as a BCP-47 primary
-- subtag ("ja", "zh", "en", "vi", …).
--
-- V1 is intentionally idempotent; V2+ use strict syntax.

alter table decks add column front_lang text;
alter table decks add column back_lang text;

alter table notes add column front_lang text;
alter table notes add column back_lang text;
