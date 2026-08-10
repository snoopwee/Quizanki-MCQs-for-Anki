-- Per-face card images (2026-08). A flashcard can carry an optional picture on
-- each side (term / definition), Quizlet/Knowt-style. We store a URL to a Supabase
-- Storage object, not the bytes. Mirrors the per-face TTS language columns (V6):
-- null = no image. V1 is intentionally idempotent; V2+ use strict syntax.
alter table notes add column front_image_url text;
alter table notes add column back_image_url text;
