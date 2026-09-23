-- Moderation for rating notes (2026-09-23) — the author's way to escalate abuse.
--
-- Its own table rather than widening the shipped `deck_reports`: that queue works, and the two
-- things being reported are different shapes (a public deck anyone can open vs a private note only
-- one person can read). Keeping them apart means the deck-report flow is untouched.
--
-- Two decisions worth keeping:
--
-- 1. `note_snapshot` holds the reported text. The author can clear a note at any time (V29), and
--    the rater can delete their whole rating — either would leave an admin judging a report with
--    nothing to read. The report carries its own copy, the same way a notification does.
--
-- 2. `rating_public_id` has NO foreign key. A report must outlive the thing it is about; a cascade
--    would erase the moderation record exactly when the note was taken down.
--
-- Also adds the notification kind that closes the loop back to whoever reported.

create table review_reports (
  id               uuid        primary key default gen_random_uuid(),
  -- The note's opaque handle (V29). No user id here: the queue judges text, not people, until an
  -- admin decides to act on the person.
  rating_public_id uuid        not null,
  deck_id          uuid        not null references decks(id) on delete cascade,
  -- Always the deck's author — nobody else can read a note to report it.
  reporter_id      text        not null,
  reason           text,
  details          text,
  note_snapshot    text        not null,
  status           text        not null default 'open',
  created_at       timestamptz not null default now(),
  resolved_at      timestamptz,
  resolved_by      text,
  constraint review_reports_status_check check (status in ('open', 'resolved', 'dismissed')),
  -- One report per note per reporter; a repeat is a no-op, matching deck_reports.
  constraint review_reports_once unique (rating_public_id, reporter_id)
);

-- The queue's only query: open ones first, newest first.
create index review_reports_status_idx on review_reports (status, created_at desc);

-- RLS on with no policies: Spring connects as postgres (BYPASSRLS), the PostgREST API gets
-- deny-all. It matters here — this table holds note text its writer expected one person to read.
alter table review_reports enable row level security;

-- "Your report was reviewed", so an author who escalates something is not left wondering.
alter table notifications drop constraint notifications_kind_check;

alter table notifications add constraint notifications_kind_check
    check (kind in ('deck_shared', 'author_published', 'announcement', 'deck_reviewed',
                    'report_reviewed'));
