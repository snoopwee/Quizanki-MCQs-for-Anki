-- Notification preferences (2026-09-23) — the app's first per-user setting, plus the kind it was
-- asked for.
--
-- Shaped as a MUTE LIST rather than a column per kind: a row means "don't send me this", absence
-- means send. Adding a mutable kind later then needs no migration and no backfill, and a person who
-- has never touched their settings has no rows at all.
--
-- Not every kind is mutable — an admin announcement is operational and stays unmutable — but that
-- is a rule about behaviour, not about storage, so it lives in NotificationKind rather than here.

create table notification_mutes (
  user_id  text        not null,
  kind     text        not null,
  muted_at timestamptz not null default now(),
  -- User first: "what has this person muted" is the only question asked on a single delivery, and
  -- it rides the primary key.
  primary key (user_id, kind)
);

-- The other direction: "which of these people have muted this kind", asked once per fan-out.
create index notification_mutes_kind_idx on notification_mutes (kind);

alter table notification_mutes enable row level security;

-- "Thanh started following you", which is what the mute list exists to switch off.
alter table notifications drop constraint notifications_kind_check;

alter table notifications add constraint notifications_kind_check
    check (kind in ('deck_shared', 'author_published', 'announcement', 'deck_reviewed',
                    'report_reviewed', 'new_follower'));
