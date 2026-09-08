-- Which fields a note type's card templates actually render (2026-09). Anki shows
-- a field only if a card template references it ({{Field}}, incl. conditionals /
-- filters like {{furigana:Field}}); fields in NO template (e.g. iKnowID, iKnowType
-- on iKnow decks) are metadata. The editor hides those by default so imported decks
-- aren't cluttered with data the author never put on a card — matching Anki's own
-- visibility. Stored so the saved-deck editor (which reads the DB, not the .apkg)
-- knows it too. Empty for decks imported before this / with no template info, which
-- then show every field as before (no backfill — the source .apkg is long gone).
alter table note_types add column template_fields text[] not null default '{}';
