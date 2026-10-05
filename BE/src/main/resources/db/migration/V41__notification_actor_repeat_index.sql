-- Serves the repeat-notification guard in NotificationService.deliver (2026-10-05).
--
-- THE ABUSE THIS CLOSES
-- ---------------------
-- `new_follower` is the only kind that carries an ACTOR but no DECK, so the existing dedup in
-- deliver() — "is there already an unread row for this user+kind+deck" — could never see it, and
-- nothing else did either. Following is idempotent, but UNFOLLOWING DELETES THE ROW, so
-- follow -> unfollow -> follow writes a brand-new follow row every time and therefore a brand-new
-- notification every time. One person could fill another's bell on a loop, as fast as they could
-- press the button.
--
-- The guard asks: has this recipient already been told about this actor, for this kind, inside the
-- cooldown window? That reads (user_id, kind, actor_id) with a lower bound on created_at, which is
-- exactly this index.
--
-- WHY PARTIAL
-- -----------
-- `actor_id is null` for admin announcements — the app itself speaking — and an announcement fans
-- out one row per user, so those are the rows there are most of. They can never match a guard that
-- requires an actor, so keeping them out costs nothing and keeps the index small.
--
-- `created_at desc` trails the equality columns so the window bound is a range scan on the end of
-- the key, not a filter. Deliberately NOT partial on `read_at is null`: the whole point is that
-- this one holds whether or not the author has read it, otherwise reading the notification would
-- re-arm the spam.
--
-- Index-only addition: nothing is dropped or renamed, so the currently deployed backend keeps
-- working through this (see the shared-database rule).

create index notifications_actor_repeat_idx
    on notifications (user_id, kind, actor_id, created_at desc)
    where actor_id is not null;
