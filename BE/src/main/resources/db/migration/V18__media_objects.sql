-- Content-addressed media registry (2026-08). Card images and audio are stored in
-- Supabase Storage keyed by the SHA-256 hex of their bytes, so identical media is
-- stored ONCE no matter how many users import the same deck (a Core-2000 deck's
-- ~400 clips + images cost one copy, not one per importer). This table is the
-- registry the backend consults to skip re-uploading a blob it already has, and
-- the source of truth for a future orphan-GC sweep. Notes keep referencing the
-- object by its public URL (…/object/public/<bucket>/<hash>) exactly as before, so
-- existing per-user objects (userId/<uuid>, pre-V18) keep working untouched.
--
-- No refcount column on purpose: a hot per-blob counter bumped on every card
-- add / edit / delete would be a write-contention hotspot (the "tanking the DB"
-- failure mode). Reclamation is done out-of-band by matching a hash against note
-- URLs (orphan sweep), never inline on the write path.
--
-- V1 is intentionally idempotent; V2+ use strict syntax.

create table media_objects (
  hash          text primary key,          -- lowercase SHA-256 hex of the bytes
  bucket        text not null,             -- Supabase Storage bucket the object lives in
  content_type  text not null,             -- sniffed MIME (never the client's claim)
  byte_size     bigint not null,           -- stored size, for GC/reporting
  created_at    timestamptz not null default now()
);

-- Defense in depth: Spring connects as postgres (BYPASSRLS); any other role sees
-- zero rows because no policies exist. Mirrors decks/notes/answer_events.
alter table media_objects enable row level security;
