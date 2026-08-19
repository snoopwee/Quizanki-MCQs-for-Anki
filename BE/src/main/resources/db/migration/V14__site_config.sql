-- Site config (2026-07-30). A single row of live, admin-editable settings the whole
-- site reads on load: maintenance mode (+ a message) and a global announcement
-- banner. "Live" = stored in the DB, not env, so a change takes effect without a
-- redeploy — the frontend reads GET /public/config and applies it.
--
-- Exactly one row, enforced by a fixed id + check, so there's a single config to
-- read and update. V1 is intentionally idempotent; V2+ use strict syntax.
create table site_config (
  id                  integer primary key default 1 check (id = 1),
  maintenance_mode    boolean not null default false,
  maintenance_message text,
  announcement        text,
  updated_at          timestamptz not null default now()
);

-- Seed the singleton row so reads always find it.
insert into site_config (id) values (1) on conflict (id) do nothing;
