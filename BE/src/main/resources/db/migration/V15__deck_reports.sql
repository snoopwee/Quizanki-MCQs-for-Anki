-- Deck reports (2026-07-30). A signed-in user can flag a public deck (spam,
-- inappropriate, copyright, …); admins review the queue and resolve/dismiss.
-- One report per (deck, reporter) so a re-report is idempotent, not spam. Cascades
-- when the deck is deleted. V1 is intentionally idempotent; V2+ use strict syntax.
create table deck_reports (
  id           uuid primary key,
  deck_id      uuid not null references decks(id) on delete cascade,
  reporter_id  text not null,
  reason       text,
  details      text,
  status       text not null default 'open',
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  resolved_by  text,
  unique (deck_id, reporter_id)
);

-- The admin queue scans by status, newest first.
create index deck_reports_status_idx on deck_reports(status, created_at desc);
