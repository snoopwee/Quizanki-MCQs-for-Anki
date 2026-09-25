-- AI deck generation: the usage ledger and bring-your-own-key storage (2026-09-21, Phase 9 S1).
--
-- Two tables, both new, so this is safe for a production backend still on the previous release —
-- local development and production share ONE database and Flyway runs from whichever backend
-- starts first (the V21 lesson).
--
-- Why a ledger rather than an in-memory counter: the free tier we generate on is billed per
-- ACCOUNT, not per user (Gemini's free RPD, Groq's org-level limits), so one shared key means one
-- shared pool. Quotas therefore have to survive a restart and be countable across instances, which
-- an in-memory limiter (see TtsRateLimiter) cannot do. It doubles as the usage evidence for
-- deciding later whether the shared pool is worth funding.
--
-- V1 is intentionally idempotent; V2+ use strict syntax.

-- ── ai_generations — one row per attempt ────────────────────────────────────
-- key_owner says who paid: 'shared' = our free-tier key (counts against the shared pool),
-- 'user' = their own key (counts only against an abuse backstop).
create table ai_generations (
  id           bigserial   primary key,
  user_id      text        not null,
  source_kind  text        not null,
  provider     text        not null,
  model        text        not null,
  key_owner    text        not null,
  input_chars  int         not null default 0,
  cards_out    int         not null default 0,
  outcome      text        not null,
  -- Provider error code when there is one; never a message that could carry user content.
  error_code   text,
  created_at   timestamptz not null default now(),
  constraint ai_generations_source_kind_check check (source_kind in ('text', 'pdf')),
  constraint ai_generations_key_owner_check check (key_owner in ('shared', 'user')),
  constraint ai_generations_outcome_check
      check (outcome in ('ok', 'quota', 'provider_error', 'invalid_input', 'invalid_key'))
);

-- The per-user daily count (the hot path on every generation).
create index ai_generations_user_time_idx on ai_generations (user_id, created_at desc);
-- The global daily ceiling across all users.
create index ai_generations_time_idx on ai_generations (created_at desc);

-- ── user_ai_keys — bring-your-own-key ───────────────────────────────────────
-- The key is AES-256-GCM ciphertext, base64(iv || ciphertext+tag), encrypted with a server-side
-- key that lives only in the environment (AI_KEY_ENCRYPTION_KEY). A database dump therefore does
-- not hand anyone a usable third-party API key. It is NEVER returned to a client and never logged;
-- the UI shows key_hint (the last four characters) so a user can tell which key they stored.
create table user_ai_keys (
  user_id        text        primary key,
  provider       text        not null,
  key_ciphertext text        not null,
  key_hint       text        not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- RLS on with no policies: Spring connects as postgres (BYPASSRLS), while the PostgREST API that
-- Supabase exposes gets deny-all (the V20 lesson). This matters more here than anywhere else in
-- the schema — user_ai_keys holds other people's credentials.
alter table ai_generations enable row level security;
alter table user_ai_keys enable row level security;
