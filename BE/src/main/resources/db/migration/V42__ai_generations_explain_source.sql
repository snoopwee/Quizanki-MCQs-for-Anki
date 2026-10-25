-- Lets the usage ledger record "explain this card" alongside deck generation (2026-10-23).
--
-- WHAT WENT WRONG
-- ---------------
-- V25 created ai_generations with `check (source_kind in ('text', 'pdf'))` — the only two kinds
-- that existed then. CardExplanationService logs its calls as 'explain', so every explanation
-- violated the constraint and the request 500'd.
--
-- The bad part was the ORDERING: the violation happened on the SUCCESS path, after the model had
-- already answered. A learner spent a generation from a shared free-tier pool, the ledger insert
-- blew up, and they got an error with nothing cached — so the next person to ask the same question
-- paid for it again. The service is being changed in the same commit so a ledger failure can never
-- again destroy a paid-for answer; this migration removes the reason it was failing at all.
--
-- WHY THIS IS SAFE AGAINST THE DEPLOYED BACKEND
-- ---------------------------------------------
-- Flyway runs on every backend start and this database is shared with production, so a migration
-- must keep the CURRENTLY DEPLOYED code working. This one only WIDENS what is permitted: every row
-- the old code writes ('text', 'pdf') still passes, and nothing reads this column for behaviour.
-- A widening is the one shape of constraint change that needs no deploy ordering.
--
-- Existing rows are untouched and cannot violate the new form — it is a strict superset.

alter table ai_generations
  drop constraint if exists ai_generations_source_kind_check;

alter table ai_generations
  add constraint ai_generations_source_kind_check
  check (source_kind in ('text', 'pdf', 'explain'));
