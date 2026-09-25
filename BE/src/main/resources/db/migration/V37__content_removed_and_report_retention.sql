-- Telling somebody their content was removed, and letting closed reports expire (2026-09-24).
--
-- Two gaps the first real moderation pass exposed:
--
--   1. A takedown was silent to the person it happened to. The REPORTER hears the outcome
--      (`report_reviewed`), but whoever wrote the rating simply found it gone. Somebody who broke
--      a rule and is never told cannot do better next time, and somebody moderated by mistake has
--      nothing to appeal. So: `content_removed`.
--   2. Closed reports piled up forever. They are evidence while a decision is live and clutter
--      afterwards, so they now carry their own expiry and a scheduled sweep clears them.
--
-- `content_removed` is NOT mutable (see NotificationKind): being told your work was removed is the
-- consequence of a decision made about you, not an update you subscribed to.

alter table notifications drop constraint notifications_kind_check;

alter table notifications add constraint notifications_kind_check
    check (kind in ('deck_shared', 'author_published', 'announcement', 'deck_reviewed',
                    'report_reviewed', 'new_follower', 'content_removed'));

-- When a closed report becomes deletable. Null while the report is still open — an open report
-- never expires, because it is still somebody's outstanding work.
alter table review_reports add column purge_after timestamptz;
alter table deck_reports   add column purge_after timestamptz;

-- The sweep reads "everything past its date", so it wants the date, not the status.
create index review_reports_purge_after_idx on review_reports (purge_after)
    where purge_after is not null;
create index deck_reports_purge_after_idx on deck_reports (purge_after)
    where purge_after is not null;

-- Backfill what is already closed, dated from when it was resolved so a report closed two weeks
-- ago does not get a fresh fifteen days.
update review_reports
set purge_after = coalesce(resolved_at, created_at) + interval '15 days'
where status <> 'open' and purge_after is null;

update deck_reports
set purge_after = coalesce(resolved_at, created_at) + interval '15 days'
where status <> 'open' and purge_after is null;
