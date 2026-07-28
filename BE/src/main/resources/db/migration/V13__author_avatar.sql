-- Author avatar (2026-07-24). The author page and deck page want to show the
-- author's profile picture next to their name. Avatars live in Supabase
-- user_metadata (custom_avatar_url / avatar_url / picture) — and, like the author
-- name, there's no user table to join, so another user's avatar can't be looked
-- up at read time. We denormalise it onto the deck alongside author_name: snapshot
-- it at write time and refresh it when the author changes their profile
-- (PUT /me/author-profile). NULL = no photo → the client shows initials.
--
-- V1 is intentionally idempotent; V2+ use strict syntax.

alter table decks add column author_avatar_url text;
