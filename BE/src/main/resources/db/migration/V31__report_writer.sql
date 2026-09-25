-- Who wrote the reported note (2026-09-23) — so an admin can reach the account behind it.
--
-- The queue deliberately showed no writer identity, which left the shipped ban flow unreachable
-- from a report: an admin could judge a note abusive and had no way to act on the person.
--
-- The identity is SNAPSHOT onto the report rather than looked up through `rating_public_id`, for a
-- reason that only appeared once an admin takedown started deleting the whole rating: the moment an
-- admin moderates, the rating row is gone, and with it every route back to who wrote it. Taking the
-- obvious action would destroy the evidence needed for the next one. Same lesson as note_snapshot.
--
-- `writer_name` is what they were called at the time — a rename afterwards shouldn't rewrite the
-- record — and is null when Supabase couldn't be reached; the id is what actually identifies them.
--
-- Both nullable: a report filed before this migration has neither, and a name may be unresolvable.
-- These reach the ADMIN queue only. The author's feedback page stays anonymous.
--
-- A separate migration rather than an edit to V30 because V30 may already have run somewhere.

alter table review_reports add column writer_id   text;
alter table review_reports add column writer_name text;
