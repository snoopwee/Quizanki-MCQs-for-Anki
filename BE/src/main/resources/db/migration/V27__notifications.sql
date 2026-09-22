-- Notifications (2026-09-22, Phase 10 S3) — one place for the app to tell a user something.
--
-- Every row is a SNAPSHOT: the title, the body and the name of whoever caused it are written once
-- and never re-derived. A notification records a moment, so it has to keep reading correctly after
-- the deck is renamed or the actor changes their display name — and rendering the list must never
-- need a join back to decks or to Supabase's auth tables. `kind`, `actor_name`, `deck_id` and
-- `link` are all sent to the client as well, so the UI can re-word a row if it ever wants to.
--
-- The table is new, so this is safe for the production backend still on the previous release.
--
-- V1 is intentionally idempotent; V2+ use strict syntax.

create table notifications (
  id         uuid        primary key default gen_random_uuid(),
  -- The RECIPIENT. Every read in NotificationService is scoped by this column, and it is the
  -- leading column of both indexes below.
  user_id    text        not null,
  kind       text        not null,
  title      text        not null,
  body       text,
  -- In-app route to open, e.g. "/decks/<id>". Nullable: an announcement may have nowhere to go.
  link       text,
  -- Who caused it. Null for an admin announcement — the app itself is speaking.
  actor_id   text,
  actor_name text,
  -- The subject deck, when there is one. ON DELETE CASCADE because a notification pointing at a
  -- deleted deck is a dead link; it should leave with the deck.
  deck_id    uuid        references decks(id) on delete cascade,
  read_at    timestamptz,
  created_at timestamptz not null default now(),
  -- Adding a kind later means a migration that replaces this constraint. That is deliberate: a
  -- typo'd kind would otherwise reach the client as an unrenderable row.
  constraint notifications_kind_check
      check (kind in ('deck_shared', 'author_published', 'announcement')),
  constraint notifications_title_not_blank check (length(btrim(title)) > 0)
);

-- The panel's only query: this user's notifications, newest first. `id` breaks ties so paging
-- cannot skip a row when a broadcast writes many rows in the same instant.
create index notifications_user_time_idx on notifications (user_id, created_at desc, id desc);

-- The bell's badge is a count of unread rows, asked for on every page load, so it gets its own
-- partial index. It stays small because a row leaves it the moment it is read.
create index notifications_user_unread_idx on notifications (user_id) where read_at is null;

-- Makes the deck cascade above cheap.
create index notifications_deck_idx on notifications (deck_id);

-- RLS on with no policies: Spring connects as postgres (BYPASSRLS), while the PostgREST API that
-- Supabase exposes gets deny-all (the V20 lesson).
alter table notifications enable row level security;
