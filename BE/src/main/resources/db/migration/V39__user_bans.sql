-- Suspensions, with a reason the suspended person can actually read (2026-09-25).
--
-- Bans used to go through Supabase's own `ban_duration`, which blocks sign-in outright. That is a
-- harder lock, but it makes the reason undeliverable: with no session the app cannot know who is
-- asking, and an endpoint that told anybody the ban reason for a typed email would be both a leak
-- and a harassment tool. So the ban moves here and is enforced by our API instead.
--
-- What that costs: a suspended person still holds a valid Supabase token. What it does not cost:
-- anything they can DO with it — every read and write goes through this backend, which refuses
-- them, and Storage is already service-role only with RLS deny-all.
--
-- HISTORY, not a flag. A lifted ban stays on the record: "banned twice before" is exactly what an
-- admin needs when deciding about a third time, and a boolean column would throw that away.

create table user_bans (
  id         uuid        primary key default gen_random_uuid(),
  user_id    text        not null,
  -- Not null: a suspension without a reason is the thing this table exists to prevent.
  reason     text        not null,
  banned_at  timestamptz not null default now(),
  banned_by  text        not null,
  -- Set when the ban is lifted. Null means it is in force.
  lifted_at  timestamptz,
  lifted_by  text,
  lift_note  text
);

-- At most one ban in force per person, enforced rather than assumed — banning twice over would
-- otherwise leave two rows and an ambiguous answer to "is this account suspended?".
create unique index user_bans_active_idx on user_bans (user_id) where lifted_at is null;

-- The history lookup for one person, newest first.
create index user_bans_user_idx on user_bans (user_id, banned_at desc);

-- Telling somebody their account is back. The suspension notice itself cannot be a notification —
-- they cannot reach the bell while suspended — but the restoration can, and it is the first thing
-- they see on return.
alter table notifications drop constraint notifications_kind_check;

alter table notifications add constraint notifications_kind_check
    check (kind in ('deck_shared', 'author_published', 'announcement', 'deck_reviewed',
                    'report_reviewed', 'new_follower', 'content_removed', 'account_restored'));

alter table user_bans enable row level security;
