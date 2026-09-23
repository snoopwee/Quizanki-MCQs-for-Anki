-- The author's private feedback page (2026-09-22) — two small additions.
--
-- 1. An opaque handle for a rating, so the author can act on one note without its writer's user id
--    ever appearing in a URL. A rating is keyed by (deck_id, user_id), and addressing notes by that
--    key would hand every author the id of everyone who rated them — and user ids are already
--    public identifiers here (a deck's author_id, /authors/{id}), so the pairing would be a real
--    disclosure: "this person gave you two stars". The feedback page shows no names for the same
--    reason; one rating per person per deck already guarantees each note is a different voice.
--
-- 2. A notification kind for "your deck got new feedback". The author is the only person who can
--    read a note, so without this the feedback would sit unseen.
--
-- Both are additive. The check constraint is replaced rather than edited: the deployed backend
-- never writes the new kind, so it keeps working either way.

alter table deck_ratings add column public_id uuid not null default gen_random_uuid();

create unique index deck_ratings_public_id_idx on deck_ratings (public_id);

alter table notifications drop constraint notifications_kind_check;

alter table notifications add constraint notifications_kind_check
    check (kind in ('deck_shared', 'author_published', 'announcement', 'deck_reviewed'));
