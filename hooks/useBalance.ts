"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getXLMBalance } from "@/lib/stellar/getBalance";

interface UseBalanceResult {
  balance: string | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

function isAbortError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "name" in err && err.name === "AbortError";
}

export function useBalance(publicKey: string | null): UseBalanceResult {
  const [balance, setBalance]   = useState<string | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!publicKey) {
      setBalance(null);
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);

    const controller = abortRef.current;

    try {
      const bal = await getXLMBalance(publicKey, controller?.signal);
      if (controller?.signal.aborted) return;
      setBalance(bal);
    } catch (err) {
      if (isAbortError(err)) {
        return;
      }
      const msg = err instanceof Error ? err.message : "Failed to fetch balance.";
      setError(msg);
      setBalance(null);
    } finally {
      if (controller?.signal.aborted) return;
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    fetchBalance();
    return () => abortRef.current?.abort();
  }, [fetchBalance]);

  return { balance, isLoading, error, refresh: fetchBalance };
}
