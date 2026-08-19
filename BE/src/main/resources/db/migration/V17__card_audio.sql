-- Per-face card audio (2026-08). Like Anki's [sound:...] clips, a flashcard can
-- carry an optional audio pronunciation on each side (term / definition). We store
-- a URL to a Supabase Storage object, not the bytes — mirrors the per-face image
-- columns (V16) and TTS language columns (V6): null = no audio on that side.
alter table notes add column front_audio_url text;
alter table notes add column back_audio_url text;
