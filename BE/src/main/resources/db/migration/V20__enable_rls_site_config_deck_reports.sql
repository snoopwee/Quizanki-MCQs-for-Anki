-- Close a Supabase security-advisor finding (2026-09): site_config (V14) and
-- deck_reports (V15) were created without RLS, so PostgREST's anon/authenticated
-- roles could read/write/delete them directly, bypassing the backend entirely
-- (site_config = maintenance flag/message + the announcement banner; deck_reports
-- = user report records including reporter_id). Every other table already has RLS
-- enabled with no policies — Spring connects as postgres (BYPASSRLS); any other
-- role sees zero rows because no policies exist. Mirrors decks/notes/media_objects.
alter table site_config  enable row level security;
alter table deck_reports enable row level security;
