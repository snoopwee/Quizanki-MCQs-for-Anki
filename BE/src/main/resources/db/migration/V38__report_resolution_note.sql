-- Why an admin did what they did (2026-09-24).
--
-- Resolving, dismissing and taking content down were all one-click. That is fine until somebody
-- asks "why is this gone?" — the queue recorded WHO acted and WHEN, never WHAT they were thinking,
-- and the report itself is deleted fifteen days later (V37), so the reasoning went with it.
--
-- Now every action carries a written reason. Two audiences, deliberately different:
--
--   * resolve / dismiss  — an INTERNAL record. Candid, for the next admin reading the row.
--   * takedown           — sent to the person whose rating was removed, in their
--                          `content_removed` notification. That is the whole point of requiring
--                          it: somebody moderated by mistake needs something to appeal.
--
-- Nullable because every row that already exists predates the requirement; new actions are
-- refused without one at the API, not by the schema, so the message can explain itself.

alter table review_reports add column resolution_note text;
alter table deck_reports   add column resolution_note text;
