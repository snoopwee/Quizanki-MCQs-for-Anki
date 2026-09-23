-- Usernames (2026-09-23, Phase 11) — a readable public profile URL.
--
-- The public page used to be /authors/{supabase-uuid}, which is unreadable, unshareable out loud,
-- and tells a stranger nothing. This is the Quizlet shape: /user/{username}.
--
-- The uuid stays the app's identity everywhere that matters — follows, decks, notifications and
-- every API path are still keyed by it — so changing a username can never orphan a row, and the
-- old /authors/{uuid} URL keeps working as a redirect. Only the page URL speaks handles.
--
-- Nullable on purpose: a handle is GENERATED (see ProfileService.ensureUsername), not supplied, so
-- there is no value a DDL default could produce. Every existing row gets one below, and every row
-- written after this gets one on the way in; null is a transient state the client falls back from.

alter table profiles add column username text;

-- Backfill. Slug the display name down to [a-z0-9], cap it, and fall back to a stable id-derived
-- handle for somebody who has never set a name.
--
-- Duplicates get an md5-of-user-id suffix rather than a counter: it is deterministic (re-running
-- this produces the same answer) and cannot collide with another duplicate of the same base, so
-- the unique index below cannot fail the migration on a database production is also using.
update profiles p
set username = case
        when b.rn = 1 then b.base
        else b.base || substr(md5(b.user_id), 1, 4)
    end
from (
    select user_id,
           base,
           row_number() over (partition by base order by updated_at, user_id) as rn
    from (
        select user_id,
               updated_at,
               coalesce(
                   nullif(substr(regexp_replace(lower(coalesce(display_name, '')), '[^a-z0-9]+', '', 'g'), 1, 24), ''),
                   'user' || substr(md5(user_id), 1, 8)
               ) as base
        from profiles
    ) slugged
) b
where p.user_id = b.user_id;

-- Case-insensitive uniqueness: "Pyrettt" and "pyrettt" are the same handle, and two people must
-- not be able to take names that differ only by case. Stored as typed so the display keeps the
-- capitalisation its owner chose.
create unique index profiles_username_lower_idx on profiles (lower(username));
