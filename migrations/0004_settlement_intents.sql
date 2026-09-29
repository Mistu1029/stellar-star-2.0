-- ============================================================================
-- 0004 — Durable settlement intents
-- ============================================================================
-- lib/settlement/intent.ts and lib/supabase/queries.ts have always read and
-- written `public.settlement_intents`, and docs/DESIGN_EXACTLY_ONCE_SETTLEMENT.md
-- specifies it as the store that makes settlement exactly-once. The table was
-- never created in any SQL file. The query layer treats a missing table as
-- "no intents" (see isMissingTable), so the feature degraded silently: nothing
-- errored, but no intent was ever recorded, and with it went the three
-- guarantees the design rests on —
--
--   1. two clients cannot pay the same debt at once (the idempotency key below
--      is what makes the second one lose),
--   2. a crash mid-submit is recoverable rather than a lost payment,
--   3. a user on a new device converges on in-flight state instead of trusting
--      localStorage.
--
-- Every statement is idempotent. No data is lost on a database that somehow
-- already has the table.
--
-- ROLLBACK: see docs/DATABASE_MIGRATIONS.md. Dropping this table re-degrades
-- settlement to the silent path above; it is documented rather than automated.

CREATE TABLE IF NOT EXISTS public.settlement_intents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Deterministic per (trip, expense, member): see deriveIdempotencyKey().
  -- The UNIQUE constraint is the concurrency guarantee — two simultaneous
  -- attempts to settle one debt collide here and exactly one proceeds.
  idempotency_key   TEXT        NOT NULL,

  trip_id           TEXT        NOT NULL,
  expense_id        TEXT        NOT NULL,
  member_id         TEXT        NOT NULL,

  -- Wallet being paid, and the wallet that owes it.
  payer_wallet      TEXT        NOT NULL,
  member_wallet     TEXT        NOT NULL,

  -- Decimal string, never a float: money must not pass through binary floating
  -- point anywhere in this system.
  amount            TEXT        NOT NULL,
  currency          TEXT        NOT NULL DEFAULT 'XLM',

  status            TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'submitting', 'submitted',
                                                  'recorded', 'failed', 'cancelled')),

  -- Filled in as the transaction progresses.
  tx_hash           TEXT,
  ledger            BIGINT,
  on_chain          BOOLEAN     NOT NULL DEFAULT FALSE,
  error_message     TEXT,

  created_by_wallet TEXT        NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Intents are short-lived; the client sets this ~15 minutes out.
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),

  CONSTRAINT settlement_intents_idempotency_key_unique UNIQUE (idempotency_key)
);

-- fetchActiveSettlementIntents filters on (member_wallet, status).
CREATE INDEX IF NOT EXISTS settlement_intents_member_status_idx
  ON public.settlement_intents (member_wallet, status);

-- fetchSettlementIntentByExpenseAndMember orders by created_at within the pair.
CREATE INDEX IF NOT EXISTS settlement_intents_expense_member_idx
  ON public.settlement_intents (expense_id, member_id, created_at DESC);

-- ─── UPDATED_AT TRIGGER ──────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS settlement_intents_set_updated_at ON public.settlement_intents;
CREATE TRIGGER settlement_intents_set_updated_at
  BEFORE UPDATE ON public.settlement_intents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────────────────────
-- An intent is visible to, and writable by, the two wallets it is between: the
-- one that owes the money and the one being paid. Nobody else can see that a
-- settlement is in flight, and nobody else can cancel or re-point one.
ALTER TABLE public.settlement_intents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS settlement_intents_select_party ON public.settlement_intents;
CREATE POLICY settlement_intents_select_party ON public.settlement_intents
  FOR SELECT TO authenticated
  USING (
    public.current_wallet() IS NOT NULL
    AND public.current_wallet() IN (member_wallet, payer_wallet)
  );

DROP POLICY IF EXISTS settlement_intents_insert_own ON public.settlement_intents;
CREATE POLICY settlement_intents_insert_own ON public.settlement_intents
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_wallet() IS NOT NULL
    AND created_by_wallet = public.current_wallet()
    AND public.current_wallet() IN (member_wallet, payer_wallet)
  );

DROP POLICY IF EXISTS settlement_intents_update_party ON public.settlement_intents;
CREATE POLICY settlement_intents_update_party ON public.settlement_intents
  FOR UPDATE TO authenticated
  USING (
    public.current_wallet() IS NOT NULL
    AND public.current_wallet() IN (member_wallet, payer_wallet)
  )
  WITH CHECK (
    public.current_wallet() IS NOT NULL
    AND public.current_wallet() IN (member_wallet, payer_wallet)
  );

DROP POLICY IF EXISTS settlement_intents_delete_owner ON public.settlement_intents;
CREATE POLICY settlement_intents_delete_owner ON public.settlement_intents
  FOR DELETE TO authenticated
  USING (
    public.current_wallet() IS NOT NULL
    AND created_by_wallet = public.current_wallet()
  );

-- ─── RECORD MIGRATION ────────────────────────────────────────────────────────

INSERT INTO public.schema_migrations (version, name, checksum)
VALUES ('0004', '0004_settlement_intents', 'settlement_intents_v1')
ON CONFLICT (version) DO NOTHING;
